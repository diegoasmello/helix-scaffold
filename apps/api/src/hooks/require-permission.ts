import { isDeclaredPermission } from '@/config/permissions'
import type { Database } from '@/db'
import { createPermissionsService } from '@/modules/permissions/permissions-service'
import type { RequirePermission } from '@/types'

// `code` tells this 403 apart from requireSubscription()'s (ApiError.code).
const FORBIDDEN = { message: 'Forbidden', code: 'permission_denied' } as const

export function createRequirePermission(database: Database): RequirePermission {
  const permissionsService = createPermissionsService(database)

  return function requirePermission(resource, action) {
    // Runs at route registration, so an undeclared pair fails at startup
    // instead of answering 403 to everyone, forever.
    if (!isDeclaredPermission(resource, action)) {
      throw new Error(
        `requirePermission('${resource}', '${action}'): RESOURCE_DEFINITIONS (src/config/permissions.ts) does not declare this action on this resource`
      )
    }

    return async (request, reply) => {
      const roleId = request.sessionUser?.roleId

      if (!roleId) {
        return reply.status(403).send(FORBIDDEN)
      }

      const allowed = await permissionsService.hasPermission(
        roleId,
        resource,
        action
      )

      if (!allowed) {
        return reply.status(403).send(FORBIDDEN)
      }
    }
  }
}
