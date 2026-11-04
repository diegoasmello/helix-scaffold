import { APIError } from 'better-auth'
import { and, eq, ne } from 'drizzle-orm'

import type { Auth } from '@/auth'
import type { Database } from '@/db'
import { account, user } from '@/db/schema'
import { env } from '@/env'
import { createAttemptLimiter } from '@/lib/attempt-limiter'
import { DomainError } from '@/lib/domain-errors'
import { type EmailProvider, escapeHtml } from '@/lib/email'

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

export function createMeService(
  database: Database,
  auth: Auth,
  emailProvider: EmailProvider
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
   * A stolen session alone must not move the account's email — the address
   * password resets go to. So it asks for the current password (accounts that
   * have one) before anything else, and tells the current address about the
   * request, so its owner can react before the change is confirmed.
   */
  async function changeEmail(
    userId: string,
    data: UpdateMeEmailInput,
    headers: Headers,
    currentEmail: string
  ) {
    await confirmPassword(userId, data.currentPassword)

    const newEmail = data.newEmail.toLowerCase()
    const [existing] = await database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, newEmail), ne(user.id, userId)))
    if (existing) {
      throw new DomainError(400, 'email_taken', 'This email is already in use')
    }
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
