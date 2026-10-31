import { config } from '@/config'
import { isSpecExport } from '@/config/spec-overrides'
import type { Database } from '@/db'
import { createPermissionsService } from '@/modules/permissions/permissions-service'
import {
  isKnownFeature,
  planHasFeature,
} from '@/modules/subscriptions/subscription-plans'
import { createSubscriptionsService } from '@/modules/subscriptions/subscriptions-service'
import type { PreHandler, RequireSubscription } from '@/types'

export function createRequireSubscription(
  database: Database
): RequireSubscription {
  const subscriptionsService = createSubscriptionsService(database)
  const permissionsService = createPermissionsService(database)

  return function requireSubscription(feature?: string): PreHandler {
    if (!config.subscriptions.enabled) {
      return async () => {}
    }

    // Runs at route registration, so a typo fails at startup. Skipped when
    // exporting the spec, whose placeholder catalog declares no features.
    if (feature && !isSpecExport() && !isKnownFeature(feature)) {
      throw new Error(
        `requireSubscription('${feature}'): no plan in subscriptions.plans (src/app.config.ts) includes this feature`
      )
    }

    return async (request, reply) => {
      // Users who can manage subscriptions are operators/admins — bypass the check.
      const { roleId } = request.sessionUser
      if (roleId) {
        const isAdmin = await permissionsService.hasPermission(
          roleId,
          'subscriptions',
          'view'
        )
        if (isAdmin) return
      }

      const sub = await subscriptionsService.getActiveByUserId(
        request.sessionUser.id
      )
      if (!sub) {
        return reply
          .status(403)
          .send({ message: 'Active subscription required' })
      }

      if (feature && !planHasFeature(sub.planId, feature)) {
        return reply
          .status(403)
          .send({ message: 'Your plan does not include this feature' })
      }
    }
  }
}
