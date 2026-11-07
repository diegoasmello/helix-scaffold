import { randomBytes } from 'node:crypto'

import { eq } from 'drizzle-orm'

import type { Auth } from '@/auth'
import type { Database } from '@/db'
import { roles, user } from '@/db/schema'
import {
  type createAuditRecorder,
  systemActor,
} from '@/modules/audit/audit-recorder'

/**
 * Sets a password nobody had to confirm — what better-auth's password reset
 * does, through its own context: hashes it, updates the credential account or,
 * for a social-only account, creates one (so it can sign in with its email
 * too), and deletes every session of the account — whoever held one must
 * sign in with the new password. The caller checks who may do it.
 */
export async function replacePassword(
  auth: Auth,
  userId: string,
  newPassword: string
) {
  const context = await auth.$context
  const hash = await context.password.hash(newPassword)
  const accounts = await context.internalAdapter.findAccounts(userId)
  if (accounts.some((a) => a.providerId === 'credential')) {
    await context.internalAdapter.updatePassword(userId, hash)
  } else {
    await context.internalAdapter.createAccount({
      userId,
      providerId: 'credential',
      accountId: userId,
      password: hash,
    })
  }
  await context.internalAdapter.deleteSessions(userId)
}

type AdminPasswordReset =
  | { status: 'reset'; userId: string; password: string }
  | { status: 'not_found' }
  | { status: 'not_admin' }

/**
 * `pnpm admin:reset-password <email>` (`src/scripts/reset-admin-password.ts`):
 * the admin's way back in when they forget their password and there is no
 * email to reset it (`email.enabled: false`) — nobody above them can set it
 * on `/users`. Only for the admin account: everyone else's password is set by
 * the admin (`PUT /users/:id/password`). A random password, which the caller
 * shows once; audited with a system actor.
 */
export async function resetAdminPassword(
  database: Database,
  auth: Auth,
  audit: ReturnType<typeof createAuditRecorder>,
  email: string
): Promise<AdminPasswordReset> {
  const [target] = await database
    .select({ id: user.id, isAdmin: roles.isAdmin })
    .from(user)
    .leftJoin(roles, eq(user.roleId, roles.id))
    .where(eq(user.email, email.trim().toLowerCase()))
  if (!target) return { status: 'not_found' }
  if (!target.isAdmin) return { status: 'not_admin' }

  const password = randomBytes(18).toString('base64url')
  await replacePassword(auth, target.id, password)
  await audit.record(systemActor('cli', 'Command line'), {
    action: 'edit',
    resource: 'users',
    resourceId: target.id,
    metadata: { passwordChanged: true },
  })
  return { status: 'reset', userId: target.id, password }
}
