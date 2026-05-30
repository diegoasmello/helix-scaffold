import { APIError } from 'better-auth'
import { fromNodeHeaders } from 'better-auth/node'
import z from 'zod'

import type { Auth } from '../../auth'
import type { Database } from '../../db'
import type { EmailProvider } from '../../lib/email'
import { getConfiguredSocialProviders } from '../../lib/social-providers'
import type { FastifyTypedInstance } from '../../types'
import { userSchema } from '../users/users-schema'
import {
  setPasswordSchema,
  updateMeEmailSchema,
  updateMePasswordSchema,
  updateMeSchema,
} from './me-schema'
import { createMeService } from './me-service'

export async function meRoutes(
  app: FastifyTypedInstance,
  {
    database,
    auth,
    emailProvider,
  }: { database: Database; auth: Auth; emailProvider: EmailProvider }
) {
  const service = createMeService(database, auth, emailProvider)

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

  app.get(
    '/me/providers',
    {
      schema: {
        operationId: 'getMeProviders',
        tags: ['me'],
        description:
          'List social providers configured on this server (for account linking)',
        response: {
          200: z.object({ providers: z.array(z.string()) }),
        },
      },
    },
    async () => ({ providers: getConfiguredSocialProviders() })
  )

  app.patch(
    '/me',
    {
      schema: {
        tags: ['me'],
        description: 'Update current user profile (name only)',
        body: updateMeSchema,
        response: { 200: userSchema },
      },
    },
    async (request) => {
      const item = await service.updateMe(request.sessionUser.id, request.body)
      await request.audit('edit', 'me', request.sessionUser.id, request.body)
      return item
    }
  )

  app.patch(
    '/me/email',
    {
      schema: {
        operationId: 'patchMeEmail',
        tags: ['me'],
        description:
          'Request an email address change (sends verification email)',
        body: updateMeEmailSchema,
        response: {
          200: z.object({ message: z.string() }),
          400: z.object({ message: z.string() }),
          500: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await service.changeEmail(
          request.body,
          fromNodeHeaders(request.headers)
        )
      } catch (error) {
        if (error instanceof APIError) {
          return reply.status(400).send({ message: error.message })
        }
        return reply
          .status(500)
          .send({ message: 'Failed to send verification email' })
      }
      await request.audit('edit', 'me', request.sessionUser.id, {
        emailChangeRequested: true,
      })
      return { message: 'Check your new email address to confirm the change' }
    }
  )

  app.post(
    '/me/set-password',
    {
      schema: {
        operationId: 'postMeSetPassword',
        tags: ['me'],
        description:
          'Set a password for a user who signed up via social provider',
        body: setPasswordSchema,
        response: {
          204: z.null().describe('Password set'),
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await service.setPassword(
          request.body,
          fromNodeHeaders(request.headers),
          request.sessionUser.email
        )
        await request.audit('edit', 'me', request.sessionUser.id, {
          passwordSet: true,
        })
        return reply.status(204).send(null)
      } catch (error) {
        if (error instanceof APIError) {
          return reply.status(400).send({ message: error.message })
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
          fromNodeHeaders(request.headers),
          request.sessionUser.email
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
