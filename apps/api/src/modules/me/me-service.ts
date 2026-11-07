import { APIError } from 'better-auth'
import { and, eq, ne } from 'drizzle-orm'

import type { Auth } from '@/auth'
import type { Database } from '@/db'
import { account, user } from '@/db/schema'
import { env } from '@/env'
import { createAttemptLimiter } from '@/lib/attempt-limiter'
import { DomainError } from '@/lib/domain-errors'
import { type EmailProvider, escapeHtml } from '@/lib/email'
import {
  getPgErrorCode,
  getPgErrorConstraint,
  PG_UNIQUE_VIOLATION,
} from '@/lib/pg-errors'
import { EmailTakenError } from '@/modules/accounts/account-provisioning'

import { getUserWithRole } from '../users/users-service'
import type {
  SetPasswordInput,
  UpdateMeEmailInput,
  UpdateMeInput,
  UpdateMePasswordInput,
} from './me-schema'

function invalidPassword() {
  return new DomainError(
    400,
    'invalid_password',
    'Current password is incorrect'
  )
}

/**
 * Without email (`email.enabled: false`) nobody but the admin changes their
 * own email: a change can't be confirmed by a link, so an administrator does
 * it on `/users`.
 */
function emailChangeUnavailable() {
  return new DomainError(
    403,
    'email_change_unavailable',
    'Email changes are made by an administrator'
  )
}

/** The new email is the current one, in any case: nothing to change. */
function emailUnchanged() {
  return new DomainError(
    400,
    'email_unchanged',
    'The new email is the current one'
  )
}

export function createMeService(
  database: Database,
  auth: Auth,
  emailProvider: EmailProvider,
  { emailEnabled }: { emailEnabled: boolean }
) {
  // Guessing the current password from a session: better-auth's own rate
  // limit does not apply to `auth.api.*` calls. One count per user, shared by
  // PATCH /me/password and PATCH /me/email.
  const passwordAttempts = createAttemptLimiter({
    maxFailures: 5,
    windowMs: 15 * 60_000,
  })

  /** The user's password hash, or `null` for a social-only account. */
  async function passwordHash(userId: string): Promise<string | null> {
    const [row] = await database
      .select({ password: account.password })
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, 'credential'))
      )
    return row?.password ?? null
  }

  /**
   * Re-authentication for a sensitive change: the current password, when the
   * account has one. 400 `current_password_required` / `invalid_password`,
   * 429 `too_many_attempts` after repeated failures.
   */
  async function confirmPassword(userId: string, password: string | undefined) {
    const hash = await passwordHash(userId)
    if (hash === null) return
    if (!password) {
      throw new DomainError(
        400,
        'current_password_required',
        'Enter your current password to change your email'
      )
    }
    passwordAttempts.assertAllowed(userId)
    const context = await auth.$context
    if (!(await context.password.verify({ hash, password }))) {
      passwordAttempts.fail(userId)
      throw invalidPassword()
    }
    passwordAttempts.reset(userId)
  }
  async function getMe(userId: string) {
    const item = await getUserWithRole(database, userId)
    // A signed-in session always belongs to an existing user.
    if (!item) throw new Error(`User ${userId} not found`)
    return item
  }

  async function updateMe(userId: string, data: UpdateMeInput) {
    if (data.name !== undefined) {
      await database.update(user).set(data).where(eq(user.id, userId))
    }
    return getMe(userId)
  }

  /**
   * Without email, the admin's own change: written at once (the caller checked
   * the admin and the password) — nobody could confirm a link, and the admin
   * has no one above them to ask. The admin already sees every account, so a
   * taken address is a plain 409 here.
   */
  async function writeEmail(userId: string, newEmail: string) {
    await database
      .update(user)
      .set({ email: newEmail })
      .where(eq(user.id, userId))
      .catch((error: unknown) => {
        if (
          getPgErrorCode(error) === PG_UNIQUE_VIOLATION &&
          getPgErrorConstraint(error) === 'user_email_unique'
        ) {
          throw new EmailTakenError()
        }
        throw error
      })
  }

  /**
   * A stolen session alone must not move the account's email — the address
   * password resets go to. So it asks for the current password (accounts that
   * have one) before anything else, and tells the current address about the
   * request, so its owner can react before the change is confirmed.
   *
   * `'requested'` when a confirmation link went to the new address,
   * `'changed'` when the email changed at once (the admin, without email).
   */
  async function changeEmail(
    userId: string,
    data: UpdateMeEmailInput,
    headers: Headers,
    currentEmail: string
  ): Promise<'requested' | 'changed'> {
    if (!emailEnabled) {
      const me = await getUserWithRole(database, userId)
      if (!me?.role?.isAdmin) throw emailChangeUnavailable()
    }
    // Before the password: nothing to change, so nothing to confirm — and no
    // attempt counted against the limit.
    const newEmail = data.newEmail.toLowerCase()
    if (newEmail === currentEmail.toLowerCase()) throw emailUnchanged()

    await confirmPassword(userId, data.currentPassword)

    if (!emailEnabled) {
      await writeEmail(userId, newEmail)
      return 'changed'
    }

    // Same answer whether the address is free or another account's: telling
    // the caller would let any signed-in user test which emails are
    // registered. better-auth already answers 200 for a taken address
    // (sending nothing); its owner gets a notice instead, below.
    const [taken] = await database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, newEmail), ne(user.id, userId)))
    await auth.api.changeEmail({
      headers,
      body: {
        newEmail: data.newEmail,
        callbackURL: `${env.CLIENT_URL}/me/account`,
      },
    })

    emailProvider
      .send(
        currentEmail,
        'Your email address is being changed',
        `<p>A change of your account's email address to <strong>${escapeHtml(newEmail)}</strong> was requested.</p>
         <p>If you did not request it, change your password now and contact your system administrator.</p>`
      )
      .catch(() => {})

    // Not awaited, like every send here: the answer must take as long either way.
    if (taken) {
      emailProvider
        .send(
          newEmail,
          'This email address is already in use',
          `<p>Someone asked to move their account to this email address, but it already belongs to an account. Nothing was changed.</p>
           <p>If it was you, sign in with this address instead. If not, you can ignore this email.</p>`
        )
        .catch(() => {})
    }
    return 'requested'
  }

  /**
   * Changes the password and signs out every session of the account — a
   * stolen one included. better-auth deletes them all and opens a new session
   * for this device: returns its `Set-Cookie` values, for the route to send.
   */
  async function updatePassword(
    userId: string,
    data: UpdateMePasswordInput,
    headers: Headers,
    userEmail: string
  ) {
    passwordAttempts.assertAllowed(userId)
    const { headers: responseHeaders } = await auth.api
      .changePassword({
        headers,
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          revokeOtherSessions: true,
        },
        returnHeaders: true,
      })
      .catch((error: unknown) => {
        if (
          error instanceof APIError &&
          error.body?.code === 'INVALID_PASSWORD'
        ) {
          passwordAttempts.fail(userId)
          throw invalidPassword()
        }
        throw error
      })
    passwordAttempts.reset(userId)

    emailProvider
      .send(
        userEmail,
        'Your password was changed',
        `<p>Your account password was successfully changed.</p>
         <p>If you did not make this change, please contact your system administrator immediately.</p>`
      )
      .catch(() => {})

    return responseHeaders.getSetCookie()
  }

  async function setPassword(
    data: SetPasswordInput,
    headers: Headers,
    userEmail: string
  ) {
    await auth.api.setPassword({
      headers,
      body: { newPassword: data.newPassword },
    })

    emailProvider
      .send(
        userEmail,
        'A password was added to your account',
        `<p>A password has been set on your account.</p>
         <p>If you did not make this change, please contact your system administrator immediately.</p>`
      )
      .catch(() => {})
  }

  return { getMe, updateMe, changeEmail, updatePassword, setPassword }
}
