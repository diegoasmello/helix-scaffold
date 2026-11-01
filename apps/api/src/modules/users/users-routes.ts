import { APIError } from 'better-auth'
import z from 'zod'

import type { Config } from '@/config'
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
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('users', 'create'),
    },
    async (request, reply) => {
      try {
        const item = await service.create(request.body)
        if (!item) throw new Error('Unexpected: user not found after creation')
        const { password: _, ...meta } = request.body
        await request.audit('create', 'users', item.id, meta)
        return reply.status(201).send(item)
      } catch (error) {
        if (
          error instanceof APIError &&
          error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
        ) {
          return reply.status(409).send({ message: 'Email already in use' })
        }
        if (
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === 'ROLE_NOT_FOUND'
        ) {
          return reply.status(404).send({ message: 'Role not found' })
        }
        throw error
      }
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
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('users', 'edit'),
    },
    async (request, reply) => {
      try {
        const item = await service.update(request.params.id, request.body)
        if (!item) return reply.status(404).send({ message: 'User not found' })
        await request.audit('edit', 'users', request.params.id, request.body)
        return item
      } catch (error) {
        if (
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === 'ROLE_NOT_FOUND'
        ) {
          return reply.status(404).send({ message: 'Role not found' })
        }
        throw error
      }
    }
  )

  app.delete(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        description: 'Delete a user',
        params: z.object({ id: z.string() }),
        response: { 204: z.null().describe('User deleted') },
      },
      preHandler: requirePermission('users', 'delete'),
    },
    async (request, reply) => {
      // 204 either way (idempotent), but only a real deletion is audited
      if (await service.remove(request.params.id)) {
        await request.audit('delete', 'users', request.params.id)
      }
      return reply.status(204).send(null)
    }
  )
}
