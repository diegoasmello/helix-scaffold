import z from 'zod'

import type { Config } from '@/config'
import { DomainError, errorSchema } from '@/lib/domain-errors'
import { buildPaginatedResponse } from '@/lib/pagination'

import type { Auth } from '../../auth'
import type { Database } from '../../db'
import type { FastifyTypedInstance, RequirePermission } from '../../types'
import {
  createUserSchema,
  paginatedUsersSchema,
  updateUserSchema,
  usersListQuerySchema,
  userWithRoleSchema,
} from './users-schema'
import { createUsersService } from './users-service'

export async function usersRoutes(
  app: FastifyTypedInstance,
  {
    database,
    auth,
    config,
    requirePermission,
  }: {
    database: Database
    auth: Auth
    config: Config
    requirePermission: RequirePermission
  }
) {
  const service = createUsersService(database, auth, config)

  app.get(
    '/users',
    {
      schema: {
        tags: ['users'],
        description: 'List users',
        querystring: usersListQuerySchema,
        response: { 200: paginatedUsersSchema },
      },
      preHandler: requirePermission('users', 'view'),
    },
    async (request) => {
      const { data, total } = await service.list(request.query)
      return buildPaginatedResponse(data, total, request.query)
    }
  )

  app.get(
    '/users/all',
    {
      schema: {
        tags: ['users'],
        description: 'List all users without pagination',
        response: { 200: z.array(userWithRoleSchema) },
      },
      preHandler: requirePermission('users', 'view'),
    },
    async () => service.listAll()
  )

  app.get(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        description: 'Get a user by id',
        params: z.object({ id: z.string() }),
        response: {
          200: userWithRoleSchema,
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('users', 'view'),
    },
    async (request, reply) => {
      const item = await service.getById(request.params.id)
      if (!item) return reply.status(404).send({ message: 'User not found' })
      return item
    }
  )

  app.post(
    '/users',
    {
      schema: {
        tags: ['users'],
        description: 'Create a user',
        body: createUserSchema,
        response: {
          201: userWithRoleSchema,
          403: errorSchema(
            'permission_denied',
            'admin_role_not_assignable',
            'role_not_assignable'
          ),
          404: errorSchema('role_not_found'),
          409: errorSchema('email_taken'),
        },
      },
      preHandler: requirePermission('users', 'create'),
    },
    async (request, reply) => {
      const item = await service.create(
        request.body,
        request.sessionUser.roleId
      )
      if (!item) throw new Error('Unexpected: user not found after creation')
      const { password: _, ...meta } = request.body
      await request.audit('create', 'users', item.id, meta)
      return reply.status(201).send(item)
    }
  )

  app.patch(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        description: 'Update a user',
        params: z.object({ id: z.string() }),
        body: updateUserSchema,
        response: {
          200: userWithRoleSchema,
          403: errorSchema(
            'permission_denied',
            'admin_role_not_assignable',
            'role_not_assignable',
            'admin_user_locked',
            'user_not_editable'
          ),
          404: errorSchema('user_not_found', 'role_not_found'),
          409: errorSchema('email_taken'),
        },
      },
      preHandler: requirePermission('users', 'edit'),
    },
    async (request) => {
      const item = await service.update(
        request.params.id,
        request.body,
        request.sessionUser.roleId
      )
      if (!item) {
        throw new DomainError(404, 'user_not_found', 'User not found')
      }
      await request.audit('edit', 'users', request.params.id, request.body)
      return item
    }
  )

  app.delete(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        description: 'Delete a user',
        params: z.object({ id: z.string() }),
        response: {
          204: z.null().describe('User deleted'),
          403: errorSchema(
            'permission_denied',
            'admin_user_locked',
            'user_not_editable'
          ),
        },
      },
      preHandler: requirePermission('users', 'delete'),
    },
    async (request, reply) => {
      // 204 either way (idempotent), but only a real deletion is audited
      if (await service.remove(request.params.id, request.sessionUser.roleId)) {
        await request.audit('delete', 'users', request.params.id)
      }
      return reply.status(204).send(null)
    }
  )
}
