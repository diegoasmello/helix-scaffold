import z from 'zod'

import { buildPaginatedResponse } from '@/lib/pagination'

import type { Database } from '../../db'
import type { FastifyTypedInstance, RequirePermission } from '../../types'
import {
  createRoleSchema,
  paginatedRolesSchema,
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
          200: roleSchema,
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('roles', 'view'),
    },
    async (request, reply) => {
      const role = await service.getById(request.params.id)
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
        response: { 201: roleSchema },
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
          200: roleSchema,
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('roles', 'edit'),
    },
    async (request, reply) => {
      const role = await service.update(request.params.id, request.body)
      if (!role) return reply.status(404).send({ message: 'Role not found' })
      await request.audit('edit', 'roles', request.params.id, request.body)
      return role
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
          409: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('roles', 'delete'),
    },
    async (request, reply) => {
      const role = await service.getById(request.params.id)
      if (role?.isDefault) {
        return reply
          .status(409)
          .send({ message: 'Cannot delete the default registration role' })
      }
      if (await service.hasUsers(request.params.id)) {
        return reply
          .status(409)
          .send({ message: 'Cannot delete a role that has assigned users' })
      }
      await service.remove(request.params.id)
      await request.audit('delete', 'roles', request.params.id)
      return reply.status(204).send(null)
    }
  )
}
