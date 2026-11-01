import type { Database } from '@/db'
import { createPermissionsService } from '@/modules/permissions/permissions-service'
import type { RequirePermission } from '@/types'

// `code` tells this 403 apart from requireSubscription()'s (ApiError.code).
const FORBIDDEN = { message: 'Forbidden', code: 'permission_denied' } as const

export function createRequirePermission(database: Database): RequirePermission {
  const permissionsService = createPermissionsService(database)

  return function requirePermission(resource: string, action: string) {
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
