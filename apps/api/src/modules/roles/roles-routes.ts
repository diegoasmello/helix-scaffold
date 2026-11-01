import z from 'zod'

import { buildPaginatedResponse } from '@/lib/pagination'
import {
  getPgErrorCode,
  getPgErrorConstraint,
  PG_UNIQUE_VIOLATION,
} from '@/lib/pg-errors'

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

// `roles.name` is unique. `code` lets the frontend show a translated message.
const nameTakenSchema = z.object({
  message: z.string(),
  code: z.enum(['name_taken']),
})

function isNameTaken(error: unknown): boolean {
  return (
    getPgErrorCode(error) === PG_UNIQUE_VIOLATION &&
    getPgErrorConstraint(error) === 'roles_name_unique'
  )
}

const NAME_TAKEN = {
  message: 'A role with this name already exists',
  code: 'name_taken',
} as const

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
        response: { 201: roleSchema, 409: nameTakenSchema },
      },
      preHandler: requirePermission('roles', 'create'),
    },
    async (request, reply) => {
      let role
      try {
        role = await service.create(request.body)
      } catch (error) {
        if (isNameTaken(error)) return reply.status(409).send(NAME_TAKEN)
        throw error
      }
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
          409: nameTakenSchema,
        },
      },
      preHandler: requirePermission('roles', 'edit'),
    },
    async (request, reply) => {
      let role
      try {
        role = await service.update(request.params.id, request.body)
      } catch (error) {
        if (isNameTaken(error)) return reply.status(409).send(NAME_TAKEN)
        throw error
      }
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
      // 204 either way (idempotent), but only a real deletion is audited
      if (await service.remove(request.params.id)) {
        await request.audit('delete', 'roles', request.params.id)
      }
      return reply.status(204).send(null)
    }
  )
}
