import { APIError } from 'better-auth'
import { fromNodeHeaders } from 'better-auth/node'
import z from 'zod'

import type { Auth } from '../../auth'
import type { Config } from '../../config'
import type { Database } from '../../db'
import { errorSchema } from '../../lib/domain-errors'
import type { EmailProvider } from '../../lib/email'
import { getUsableSocialProviders } from '../../lib/social-providers'
import type { FastifyTypedInstance } from '../../types'
import { userWithRoleSchema } from '../users/users-schema'
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
    config,
    emailProvider,
  }: {
    database: Database
    auth: Auth
    config: Config
    emailProvider: EmailProvider
  }
) {
  const service = createMeService(database, auth, emailProvider, {
    emailEnabled: config.email.enabled,
  })

  app.get(
    '/me',
    {
      schema: {
        tags: ['me'],
        description: 'Get current user profile, with their role',
        response: { 200: userWithRoleSchema },
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
          'Social providers the user can link (none in closed registration mode)',
        response: {
          200: z.object({ providers: z.array(z.string()) }),
        },
      },
    },
    async () => ({ providers: getUsableSocialProviders(config) })
  )

  app.patch(
    '/me',
    {
      schema: {
        tags: ['me'],
        description: 'Update current user profile (name only)',
        body: updateMeSchema,
        response: { 200: userWithRoleSchema },
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
          'Request an email address change. Accounts with a password must send `currentPassword`. With email on, a confirmation link goes to the new address and the current one is told about the request (`changed: false`). With email off (`email.enabled: false`), only the admin may change their email, at once (`changed: true`); anyone else gets 403 `email_change_unavailable`',
        body: updateMeEmailSchema,
        response: {
          200: z.object({
            message: z.string(),
            changed: z
              .boolean()
              .describe(
                '`true` when the email changed at once, `false` when it waits for the link sent to the new address'
              ),
          }),
          400: errorSchema(
            'current_password_required',
            'invalid_password',
            'email_unchanged',
            'email_change_rejected'
          ),
          403: errorSchema('email_change_unavailable'),
          409: errorSchema('email_taken'),
          429: errorSchema('too_many_attempts'),
        },
      },
    },
    async (request, reply) => {
      let outcome: 'requested' | 'changed'
      try {
        outcome = await service.changeEmail(
          request.sessionUser.id,
          request.body,
          fromNodeHeaders(request.headers),
          request.sessionUser.email
        )
      } catch (error) {
        // better-auth refusing the change (link mode). Anything else — a
        // DomainError, a database failure — goes on to the error handlers.
        if (error instanceof APIError) {
          return reply
            .status(400)
            .send({ message: error.message, code: 'email_change_rejected' })
        }
        throw error
      }
      if (outcome === 'changed') {
        await request.audit('edit', 'me', request.sessionUser.id, {
          emailChanged: true,
        })
        return { message: 'Email address changed', changed: true }
      }
      await request.audit('edit', 'me', request.sessionUser.id, {
        emailChangeRequested: true,
      })
      return {
        message: 'Check your new email address to confirm the change',
        changed: false,
      }
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
          400: errorSchema('invalid_password', 'password_change_rejected'),
          429: errorSchema('too_many_attempts'),
        },
      },
    },
    async (request, reply) => {
      try {
        const sessionCookies = await service.updatePassword(
          request.sessionUser.id,
          request.body,
          fromNodeHeaders(request.headers),
          request.sessionUser.email
        )
        await request.audit('edit', 'me', request.sessionUser.id, {
          passwordChanged: true,
        })
        // Every session was revoked, this one too: keep the device signed in
        // with the new session better-auth opened for it.
        return reply.header('set-cookie', sessionCookies).status(204).send(null)
      } catch (error) {
        if (error instanceof APIError) {
          return reply
            .status(400)
            .send({ message: error.message, code: 'password_change_rejected' })
        }
        throw error
      }
    }
  )
}
