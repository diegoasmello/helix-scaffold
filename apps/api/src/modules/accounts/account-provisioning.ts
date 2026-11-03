import { APIError } from 'better-auth'
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm'

import type { Auth } from '@/auth'
import type { Config } from '@/config'
import { ALL_PERMISSIONS } from '@/config/permissions'
import type { Database } from '@/db'
import { rolePermissions, roles, subscriptions, user } from '@/db/schema'
import { DomainError } from '@/lib/domain-errors'
import { getPgErrorCode, PG_FOREIGN_KEY_VIOLATION } from '@/lib/pg-errors'

/**
 * Account provisioning: every way a user comes into existence, and what each
 * kind of account gets.
 *
 * | Kind | Entry point | Role | Trial |
 * | --- | --- | --- | --- |
 * | first admin | `provisionFirstAdmin()` (POST /bootstrap) | Admin, every permission | no |
 * | admin-created | `provisionAccount()` (POST /users) | the one given, or none | no |
 * | seeded | `provisionAccount()` (src/db/seed.ts) | the one given | no |
 * | self-registered | `applySelfRegistrationDefaults()` (better-auth hook) | the default role | when configured |
 *
 * better-auth writes the user through its own connection, so the user row can
 * never join a transaction: each kind creates it first and deletes it again
 * when the rest fails, so no half-provisioned account is left behind.
 */

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export interface NewAccount {
  name: string
  email: string
  password: string
}

/** The slice of a pino/Fastify logger this module needs. */
export interface ProvisioningLogger {
  error: (obj: object, msg: string) => void
  warn: (obj: object, msg: string) => void
}

/** `provisionAccount()` was given a `roleId` that does not exist (404 `role_not_found`). */
export class RoleNotFoundError extends DomainError {
  constructor() {
    super(404, 'role_not_found', 'Role not found')
  }
}

/** Another account already uses the email (409 `email_taken`). */
export class EmailTakenError extends DomainError {
  constructor() {
    super(409, 'email_taken', 'Email already in use')
  }
}

export type FirstAdminResult =
  | { status: 'created'; userId: string }
  | { status: 'already_bootstrapped' }

/**
 * In open registration, makes sure a default role (`roles.isDefault`) exists
 * for self-registered users. A role already marked default is kept as is.
 * Otherwise "User" becomes the default: created with no permissions (the
 * profile only needs a session; what regular users may do is a product
 * decision), or promoted with its permissions if a role by that name exists.
 * No-op in closed mode.
 */
export async function ensureDefaultRole(
  database: Database | Transaction,
  config: Pick<Config, 'registration'>
) {
  if (config.registration.mode !== 'open') return

  const [existingDefault] = await database
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.isDefault, true))
    .limit(1)
  if (existingDefault) return

  await database
    .insert(roles)
    .values({
      name: 'User',
      description: 'Default role for self-registered users',
      isDefault: true,
    })
    .onConflictDoUpdate({ target: roles.name, set: { isDefault: true } })
}

/**
 * What a self-registered user gets in open registration mode: the default role
 * and, when configured, a trial subscription. Called from the better-auth
 * `user.create.after` hook in `src/auth.ts` — only for sign-ups that arrive
 * over HTTP (`/sign-up/email` or a social callback). Nothing in closed mode.
 */
export async function applySelfRegistrationDefaults(
  database: Database,
  userId: string,
  config: {
    registration: Pick<Config['registration'], 'mode'>
    subscriptions: Pick<Config['subscriptions'], 'enabled' | 'trial'>
  },
  logger: ProvisioningLogger
) {
  if (config.registration.mode !== 'open') return

  const [defaultRole] = await database
    .select()
    .from(roles)
    .where(eq(roles.isDefault, true))
    .limit(1)
  if (defaultRole) {
    await database
      .update(user)
      .set({ roleId: defaultRole.id })
      .where(eq(user.id, userId))
  } else {
    // The sign-up still succeeds, but the user can only open /me.
    logger.warn(
      { userId },
      'Self-registered user got no role: no role is marked as default'
    )
  }

  const { enabled, trial } = config.subscriptions
  if (enabled && trial) {
    const now = new Date()
    const trialEndsAt = new Date(now)
    trialEndsAt.setDate(trialEndsAt.getDate() + trial.days)
    // Best-effort: a failed trial must not fail the sign-up — but it is
    // logged, or the user silently ends up without access.
    await database
      .insert(subscriptions)
      .values({
        userId,
        planId: trial.planId,
        status: 'trialing',
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      })
      .catch((err: unknown) =>
        logger.error({ err, userId }, 'Trial subscription creation failed')
      )
  }
}

export function createAccountProvisioning(
  database: Database,
  auth: Auth,
  config: Pick<Config, 'registration'>
) {
  async function isBootstrapped(): Promise<boolean> {
    const [{ count }] = await database
      .select({ count: sql<number>`count(*)` })
      .from(user)
    return Number(count) > 0
  }

  // Server-side sign-ups carry no request, so the better-auth hook gives them
  // no default role and no trial — see applySelfRegistrationDefaults().
  async function signUp(account: NewAccount) {
    try {
      const { user: created } = await auth.api.signUpEmail({
        body: {
          name: account.name,
          email: account.email,
          password: account.password,
        },
      })
      return created.id
    } catch (error) {
      if (
        error instanceof APIError &&
        error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
      ) {
        throw new EmailTakenError()
      }
      throw error
    }
  }

  // Sessions and accounts cascade from the user row.
  async function discard(userId: string) {
    await database.delete(user).where(eq(user.id, userId))
  }

  /**
   * The first admin: the account, the "Admin" role with every permission
   * and, in open mode, the default role. All or nothing — a failure (or a
   * concurrent bootstrap that won) deletes the user again.
   */
  async function provisionFirstAdmin(
    account: NewAccount
  ): Promise<FirstAdminResult> {
    if (await isBootstrapped()) return { status: 'already_bootstrapped' }

    const userId = await signUp(account)

    let raced = false
    try {
      await database.transaction(async (tx) => {
        // Serialises concurrent bootstraps: the one that gets the lock first
        // finishes; the other then finds an admin and backs out. Both users
        // may already exist at this point (better-auth created them outside
        // the lock), so "another user exists" would make both back out — only
        // a user who already got a role counts.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('helix:bootstrap'))`
        )
        const [winner] = await tx
          .select({ id: user.id })
          .from(user)
          .where(and(ne(user.id, userId), isNotNull(user.roleId)))
          .limit(1)
        if (winner) {
          raced = true
          tx.rollback()
        }

        // With no users, a leftover "Admin" role (users deleted by hand) is
        // reused: it stops being the default role and gets the full catalog.
        const [adminRole] = await tx
          .insert(roles)
          .values({ name: 'Admin', description: 'Full system access' })
          .onConflictDoUpdate({
            target: roles.name,
            set: { description: 'Full system access', isDefault: false },
          })
          .returning()

        await tx
          .delete(rolePermissions)
          .where(eq(rolePermissions.roleId, adminRole.id))
        await tx.insert(rolePermissions).values(
          ALL_PERMISSIONS.map(({ resource, action }) => ({
            roleId: adminRole.id,
            resource,
            action,
          }))
        )

        await tx
          .update(user)
          .set({ roleId: adminRole.id })
          .where(eq(user.id, userId))

        await ensureDefaultRole(tx, config)
      })
    } catch (error) {
      await discard(userId)
      if (raced) return { status: 'already_bootstrapped' }
      throw error
    }

    return { status: 'created', userId }
  }

  /**
   * An account created by the server — by an admin (POST /users) or the
   * seed — with `roleId` (or no role). Throws `RoleNotFoundError` for an
   * unknown role and `EmailTakenError` for a used email; a failed role assignment deletes the user again.
   */
  async function provisionAccount(
    account: NewAccount & { roleId?: string | null }
  ): Promise<string> {
    const { roleId } = account
    if (roleId) {
      const [role] = await database
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.id, roleId))
      if (!role) throw new RoleNotFoundError()
    }

    const userId = await signUp(account)
    if (!roleId) return userId

    try {
      await database.update(user).set({ roleId }).where(eq(user.id, userId))
    } catch (error) {
      await discard(userId)
      // The role was deleted between the check and the assignment.
      if (getPgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
        throw new RoleNotFoundError()
      }
      throw error
    }
    return userId
  }

  return { isBootstrapped, provisionFirstAdmin, provisionAccount }
}
