import z from 'zod'

import { RESOURCE_DEFINITIONS } from '@/config/permissions'

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
      RESOURCE_DEFINITIONS.map((def) => ({ ...def, actions: [...def.actions] }))
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
        response: { 200: rolePermissionsResponseSchema },
      },
      preHandler: requirePermission('permissions', 'edit'),
    },
    async (request) => {
      const grants = await service.replaceForRole(
        request.params.id,
        request.body.grants
      )
      return { grants }
    }
  )
}
