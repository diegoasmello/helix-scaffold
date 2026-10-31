import { config } from '@/config'
import type { Database } from '@/db'
import { createPermissionsService } from '@/modules/permissions/permissions-service'
import { createSubscriptionsService } from '@/modules/subscriptions/subscriptions-service'
import type { PreHandler, RequireSubscription } from '@/types'

export function createRequireSubscription(
  database: Database
): RequireSubscription {
  const subscriptionsService = createSubscriptionsService(database)
  const permissionsService = createPermissionsService(database)

  return function requireSubscription(): PreHandler {
    if (!config.subscriptions.enabled) {
      return async () => {}
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
    }
  }
}
