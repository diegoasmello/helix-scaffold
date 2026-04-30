import { APIError } from 'better-auth'
import z from 'zod'

import type { Auth } from '../../auth'
import type { Database } from '../../db'
import type { FastifyTypedInstance, RequirePermission } from '../../types'
import { createUserSchema, updateUserSchema, userSchema } from './users-schema'
import { createUsersService } from './users-service'

export async function usersRoutes(
  app: FastifyTypedInstance,
  {
    database,
    auth,
    requirePermission,
  }: { database: Database; auth: Auth; requirePermission: RequirePermission }
) {
  const service = createUsersService(database, auth)

  app.get(
    '/users',
    {
      schema: {
        tags: ['users'],
        description: 'List users',
        response: { 200: z.array(userSchema) },
      },
      preHandler: requirePermission('users', 'view'),
    },
    async () => service.list()
  )

  app.get(
    '/users/:id',
    {
      schema: {
        tags: ['users'],
        description: 'Get a user by id',
        params: z.object({ id: z.string() }),
        response: {
          200: userSchema,
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
          201: userSchema,
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('users', 'create'),
    },
    async (request, reply) => {
      try {
        const item = await service.create(request.body)
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
          200: userSchema,
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
      await service.remove(request.params.id)
      await request.audit('delete', 'users', request.params.id)
      return reply.status(204).send(null)
    }
  )
}
