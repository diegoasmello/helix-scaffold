import { eq } from 'drizzle-orm'

import type { config } from '@/config'
import type { Database } from '@/db'
import { roles, subscriptions, user } from '@/db/schema'

type SubscriptionsConfig = Pick<
  (typeof config)['subscriptions'],
  'enabled' | 'trial'
>

/** The slice of a pino/Fastify logger this module needs. */
export interface ErrorLogger {
  error: (obj: object, msg: string) => void
}

/**
 * What a self-registered user gets in open registration mode: the default role
 * (`roles.isDefault`) and, when configured, a trial subscription. Called from
 * the better-auth `user.create.after` hook in `src/auth.ts` — only for sign-ups
 * that arrive over HTTP (`/sign-up/email` or a social callback). Accounts the
 * server creates itself (`POST /users`, bootstrap, seed) get neither.
 */
export async function applySelfRegistrationDefaults(
  database: Database,
  userId: string,
  { enabled, trial }: SubscriptionsConfig,
  logger: ErrorLogger
) {
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
  }

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
