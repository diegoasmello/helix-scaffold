import { config } from '@/config'
import { isSpecExport } from '@/config/spec-overrides'
import type { Database } from '@/db'
import {
  createEntitlementsService,
  denialFor,
  type EntitlementDenial,
} from '@/modules/subscriptions/entitlements'
import { isKnownFeature } from '@/modules/subscriptions/subscription-plans'
import type { PreHandler, RequireSubscription } from '@/types'

const DENIAL_MESSAGES: Record<EntitlementDenial, string> = {
  subscription_required: 'Active subscription required',
  feature_not_in_plan: 'Your plan does not include this feature',
}

export function createRequireSubscription(
  database: Database
): RequireSubscription {
  const entitlementsService = createEntitlementsService(database)

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
      const entitlements = await entitlementsService.forUser(
        request.sessionUser
      )
      const denial = denialFor(entitlements, feature)
      if (denial) {
        return reply
          .status(403)
          .send({ message: DENIAL_MESSAGES[denial], code: denial })
      }
    }
  }
}
