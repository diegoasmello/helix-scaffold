import z from 'zod'

import type { Config } from '@/config'
import {
  directRequirementsOf,
  dropUnmetRequirements,
  enabledResourceDefinitions,
  findAdminOnlyGrants,
  findDisabledGrants,
  findMissingRequirements,
  findUnknownGrants,
  onlyDisabledResources,
  withoutDisabledResources,
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
    config,
    requirePermission,
  }: {
    database: Database
    config: Config
    requirePermission: RequirePermission
  }
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
      enabledResourceDefinitions(config).map((def) => ({
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
      return { grants: withoutDisabledResources(grants, config) }
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
            'admin_role_locked',
            'role_not_editable',
            'permissions_not_grantable'
          ),
          404: errorSchema('role_not_found'),
        },
      },
      preHandler: requirePermission('permissions', 'edit'),
    },
    async (request) => {
      // A resource turned off in the config (`RESOURCE_TOGGLES`) and an
      // admin-only permission (`ADMIN_ONLY_PERMISSIONS`) are as unknown as a
      // typo: the role editor neither shows nor sends them.
      const unknown = [
        ...new Set([
          ...findUnknownGrants(request.body.grants),
          ...findDisabledGrants(request.body.grants, config),
          ...findAdminOnlyGrants(request.body.grants),
        ]),
      ]
      if (unknown.length > 0) {
        throw new DomainError(
          400,
          'unknown_permissions',
          `Unknown permissions: ${unknown.join(', ')}`
        )
      }

      // Privilege ceiling: the admin role and a role above the actor's stay
      // as they are, and nobody grants a permission their own role lacks.
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

      // The grants of resources turned off are kept, minus those whose
      // requirements the body no longer brings — as the editor unchecks what
      // depends on a permission it unchecks.
      const { kept, dropped } = dropUnmetRequirements(
        request.body.grants,
        onlyDisabledResources(
          await service.getByRoleId(request.params.id),
          config
        )
      )
      const next = { ...request.body.grants, ...kept }

      // Checked after the ceiling: a refused grant answers 403 whatever else
      // the body lacks.
      const missing = findMissingRequirements(next)
      if (missing.length > 0) {
        throw new DomainError(
          400,
          'missing_required_permissions',
          `Missing required permissions: ${missing.join(', ')}`
        )
      }

      let grants: Awaited<ReturnType<typeof service.replaceForRole>>
      try {
        grants = await service.replaceForRole(request.params.id, next)
      } catch (error) {
        if (getPgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
          throw new DomainError(404, 'role_not_found', 'Role not found')
        }
        throw error
      }

      // The role holds `grants` plus `kept`; `dropped` were removed although
      // the body could not name them.
      const isEmpty = (value: object) => Object.keys(value).length === 0
      await request.audit('edit', 'permissions', request.params.id, {
        grants: request.body.grants,
        ...(!isEmpty(kept) && { kept }),
        ...(!isEmpty(dropped) && { dropped }),
      })
      return { grants: withoutDisabledResources(grants, config) }
    }
  )
}
