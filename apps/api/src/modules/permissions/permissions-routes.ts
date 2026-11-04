import z from 'zod'

import {
  directRequirementsOf,
  findMissingRequirements,
  findUnknownGrants,
  RESOURCE_DEFINITIONS,
} from '@/config/permissions'
import { DomainError, errorSchema } from '@/lib/domain-errors'
import { getPgErrorCode, PG_FOREIGN_KEY_VIOLATION } from '@/lib/pg-errors'

import type { Database } from '../../db'
import type { FastifyTypedInstance, RequirePermission } from '../../types'
import {
  resourceDefinitionSchema,
  rolePermissionsResponseSchema,
} from './permissions-schema'
import { createPermissionsService } from './permissions-service'

export async function permissionsRoutes(
  app: FastifyTypedInstance,
  {
    database,
    requirePermission,
  }: { database: Database; requirePermission: RequirePermission }
) {
  const service = createPermissionsService(database)

  app.get(
    '/permissions/resources',
    {
      schema: {
        tags: ['permissions'],
        description: 'List available resources and their actions',
        response: { 200: z.array(resourceDefinitionSchema) },
      },
    },
    async () =>
      RESOURCE_DEFINITIONS.map((def) => ({
        ...def,
        actions: [...def.actions],
        requires: directRequirementsOf(def.resource),
      }))
  )

  app.get(
    '/me/permissions',
    {
      schema: {
        tags: ['permissions'],
        description: 'Get current user permissions',
        response: { 200: rolePermissionsResponseSchema },
      },
    },
    async (request) => {
      const { roleId } = request.sessionUser
      if (!roleId) return { grants: {} }
      const grants = await service.getByRoleId(roleId)
      return { grants }
    }
  )

  app.get(
    '/roles/:id/permissions',
    {
      schema: {
        tags: ['permissions'],
        description: 'Get permissions for a role',
        params: z.object({ id: z.string() }),
        response: { 200: rolePermissionsResponseSchema },
      },
      preHandler: requirePermission('permissions', 'view'),
    },
    async (request) => {
      const grants = await service.getByRoleId(request.params.id)
      return { grants }
    }
  )

  app.put(
    '/roles/:id/permissions',
    {
      schema: {
        tags: ['permissions'],
        description: 'Replace permissions for a role',
        params: z.object({ id: z.string() }),
        body: rolePermissionsResponseSchema,
        response: {
          200: rolePermissionsResponseSchema,
          400: errorSchema(
            'unknown_permissions',
            'missing_required_permissions'
          ),
          403: errorSchema(
            'permission_denied',
            'role_not_editable',
            'permissions_not_grantable'
          ),
          404: errorSchema('role_not_found'),
        },
      },
      preHandler: requirePermission('permissions', 'edit'),
    },
    async (request) => {
      const unknown = findUnknownGrants(request.body.grants)
      if (unknown.length > 0) {
        throw new DomainError(
          400,
          'unknown_permissions',
          `Unknown permissions: ${unknown.join(', ')}`
        )
      }

      // Privilege ceiling: a role above the actor's stays as it is, and nobody
      // grants a permission their own role lacks.
      const actorGrants = await service.assertRoleManageable(
        request.params.id,
        request.sessionUser.roleId
      )
      const ungrantable = [
        ...new Set(
          Object.entries(request.body.grants).flatMap(([resource, actions]) =>
            actions.map((action) => `${resource}:${action}`)
          )
        ),
      ].filter((grant) => !actorGrants.has(grant))
      if (ungrantable.length > 0) {
        throw new DomainError(
          403,
          'permissions_not_grantable',
          `Your own role lacks: ${ungrantable.join(', ')}`
        )
      }

      // Checked after the ceiling: a refused grant answers 403 whatever else
      // the body lacks.
      const missing = findMissingRequirements(request.body.grants)
      if (missing.length > 0) {
        throw new DomainError(
          400,
          'missing_required_permissions',
          `Missing required permissions: ${missing.join(', ')}`
        )
      }

      let grants: Awaited<ReturnType<typeof service.replaceForRole>>
      try {
        grants = await service.replaceForRole(
          request.params.id,
          request.body.grants
        )
      } catch (error) {
        if (getPgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
          throw new DomainError(404, 'role_not_found', 'Role not found')
        }
        throw error
      }

      await request.audit('edit', 'permissions', request.params.id, {
        grants: request.body.grants,
      })
      return { grants }
    }
  )
}
