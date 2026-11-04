import z from 'zod'

import { errorSchema } from '@/lib/domain-errors'
import { buildPaginatedResponse } from '@/lib/pagination'

import type { Database } from '../../db'
import type { FastifyTypedInstance, RequirePermission } from '../../types'
import {
  createRoleSchema,
  paginatedRolesSchema,
  roleDetailSchema,
  roleSchema,
  rolesListQuerySchema,
  updateRoleSchema,
} from './roles-schema'
import { createRolesService } from './roles-service'

export async function rolesRoutes(
  app: FastifyTypedInstance,
  {
    database,
    requirePermission,
  }: { database: Database; requirePermission: RequirePermission }
) {
  const service = createRolesService(database)

  app.get(
    '/roles',
    {
      schema: {
        tags: ['roles'],
        description: 'List roles',
        querystring: rolesListQuerySchema,
        response: { 200: paginatedRolesSchema },
      },
      preHandler: requirePermission('roles', 'view'),
    },
    async (request) => {
      const { data, total } = await service.list(request.query)
      return buildPaginatedResponse(data, total, request.query)
    }
  )

  app.get(
    '/roles/all',
    {
      schema: {
        tags: ['roles'],
        description: 'List all roles without pagination',
        response: { 200: z.array(roleSchema) },
      },
      preHandler: requirePermission('roles', 'view'),
    },
    async () => service.listAll()
  )

  app.get(
    '/roles/:id',
    {
      schema: {
        tags: ['roles'],
        description: 'Get a role by id',
        params: z.object({ id: z.string() }),
        response: {
          200: roleDetailSchema,
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('roles', 'view'),
    },
    async (request, reply) => {
      const role = await service.getDetail(
        request.params.id,
        request.sessionUser.roleId
      )
      if (!role) return reply.status(404).send({ message: 'Role not found' })
      return role
    }
  )

  app.post(
    '/roles',
    {
      schema: {
        tags: ['roles'],
        description: 'Create a role',
        body: createRoleSchema,
        response: { 201: roleSchema, 409: errorSchema('name_taken') },
      },
      preHandler: requirePermission('roles', 'create'),
    },
    async (request, reply) => {
      const role = await service.create(request.body)
      await request.audit('create', 'roles', role.id, request.body)
      return reply.status(201).send(role)
    }
  )

  app.patch(
    '/roles/:id',
    {
      schema: {
        tags: ['roles'],
        description: 'Update a role',
        params: z.object({ id: z.string() }),
        body: updateRoleSchema,
        response: {
          200: roleDetailSchema,
          403: errorSchema(
            'permission_denied',
            'admin_role_locked',
            'role_not_editable'
          ),
          404: z.object({ message: z.string() }),
          409: errorSchema('name_taken'),
        },
      },
      preHandler: requirePermission('roles', 'edit'),
    },
    async (request, reply) => {
      const role = await service.update(
        request.params.id,
        request.body,
        request.sessionUser.roleId
      )
      if (!role) return reply.status(404).send({ message: 'Role not found' })
      await request.audit('edit', 'roles', request.params.id, request.body)
      // `update()` let it through and changes no grant: still manageable.
      // Same shape as `GET /roles/:id`, whose cache the clients seed with it.
      return { ...role, manageable: true }
    }
  )

  app.delete(
    '/roles/:id',
    {
      schema: {
        tags: ['roles'],
        description: 'Delete a role',
        params: z.object({ id: z.string() }),
        response: {
          204: z.null().describe('Role deleted'),
          403: errorSchema(
            'permission_denied',
            'admin_role_locked',
            'role_not_editable'
          ),
          409: errorSchema('default_role', 'role_in_use'),
        },
      },
      preHandler: requirePermission('roles', 'delete'),
    },
    async (request, reply) => {
      // 204 either way (idempotent), but only a real deletion is audited
      if (await service.remove(request.params.id, request.sessionUser.roleId)) {
        await request.audit('delete', 'roles', request.params.id)
      }
      return reply.status(204).send(null)
    }
  )
}
