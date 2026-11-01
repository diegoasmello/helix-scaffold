import type { Database } from '@/db'
import { type AuditRecorder, systemActor } from '@/modules/audit/audit-recorder'

import { createSubscriptionsService } from './subscriptions-service'

/** The slice of a pino/Fastify logger this module needs. */
interface JobLogger {
  info: (msg: string) => void
  error: (obj: object, msg: string) => void
}

const EXPIRATION_ACTOR = systemActor(
  'subscription-expiration',
  'Subscription expiration'
)

/**
 * The expiration job `server.ts` runs at startup and every
 * `subscriptions.expiration.intervalHours`: marks lapsed scaffold-owned
 * subscriptions as `expired` (see `expireLapsed`) and records one audit entry
 * per subscription, by the system. Never throws — a failed run is logged and
 * the next one retries.
 */
export function createSubscriptionExpirationJob(
  database: Database,
  audit: AuditRecorder,
  logger: JobLogger
) {
  const service = createSubscriptionsService(database)

  return async function expireLapsedSubscriptions(now = new Date()) {
    let expired: string[]
    try {
      ;({ expired } = await service.expireLapsed(now))
    } catch (err) {
      logger.error({ err }, 'Subscription expiration failed')
      return
    }

    for (const id of expired) {
      await audit.record(EXPIRATION_ACTOR, {
        action: 'edit',
        resource: 'subscriptions',
        resourceId: id,
        metadata: { source: 'expiration-job', status: 'expired' },
      })
    }
    if (expired.length > 0) {
      logger.info(
        `Subscription expiration: expired ${expired.length} subscriptions`
      )
    }
  }
}
