import { APIError } from 'better-auth'
import { fromNodeHeaders } from 'better-auth/node'
import z from 'zod'

import type { Auth } from '../../auth'
import type { Database } from '../../db'
import type { FastifyTypedInstance } from '../../types'
import { userSchema } from '../users/users-schema'
import { updateMePasswordSchema, updateMeSchema } from './me-schema'
import { createMeService } from './me-service'

export async function meRoutes(
  app: FastifyTypedInstance,
  { database, auth }: { database: Database; auth: Auth }
) {
  const service = createMeService(database, auth)

  app.get(
    '/me',
    {
      schema: {
        tags: ['me'],
        description: 'Get current user profile',
        response: { 200: userSchema },
      },
    },
    async (request) => service.getMe(request.sessionUser.id)
  )

  app.patch(
    '/me',
    {
      schema: {
        tags: ['me'],
        description: 'Update current user profile',
        body: updateMeSchema,
        response: {
          200: userSchema,
          409: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const item = await service.updateMe(
          request.sessionUser.id,
          request.body
        )
        await request.audit('edit', 'me', request.sessionUser.id, request.body)
        return item
      } catch (error) {
        // PostgreSQL unique constraint violation (23505), possibly wrapped by Drizzle
        const pgCode =
          (error as { code?: string }).code ??
          (error as { cause?: { code?: string } }).cause?.code
        if (pgCode === '23505') {
          return reply.status(409).send({ message: 'Email already in use' })
        }
        throw error
      }
    }
  )

  app.patch(
    '/me/password',
    {
      schema: {
        tags: ['me'],
        description: 'Change current user password',
        body: updateMePasswordSchema,
        response: {
          204: z.null().describe('Password changed'),
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await service.updatePassword(
          request.body,
          fromNodeHeaders(request.headers)
        )
        await request.audit('edit', 'me', request.sessionUser.id, {
          passwordChanged: true,
        })
        return reply.status(204).send(null)
      } catch (error) {
        if (error instanceof APIError) {
          return reply
            .status(400)
            .send({ message: 'Current password is incorrect' })
        }
        throw error
      }
    }
  )
}
