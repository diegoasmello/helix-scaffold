import z from 'zod'

import type { Database } from '@/db'
import { buildPaginatedResponse } from '@/lib/pagination'
import {
  getPgErrorCode,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '@/lib/pg-errors'
import type { FastifyTypedInstance, RequirePermission } from '@/types'

import {
  createSubscriptionSchema,
  paginatedSubscriptionsSchema,
  subscriptionSchema,
  subscriptionsListQuerySchema,
  updateSubscriptionSchema,
} from './subscriptions-schema'
import { createSubscriptionsService } from './subscriptions-service'

// Enforced by the `subscriptions_one_live_per_user` partial unique index.
const LIVE_SUBSCRIPTION_CONFLICT =
  'User already has an active or trialing subscription'

export async function subscriptionsRoutes(
  app: FastifyTypedInstance,
  {
    database,
    requirePermission,
  }: { database: Database; requirePermission: RequirePermission }
) {
  const service = createSubscriptionsService(database)

  app.get(
    '/me/subscription',
    {
      schema: {
        operationId: 'getMeSubscription',
        tags: ['subscriptions'],
        description: 'Get current user active subscription',
        response: {
          200: subscriptionSchema.nullable(),
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const sub = await service.getActiveByUserId(request.sessionUser.id)
      if (!sub) return reply.status(204).send(null)
      return sub
    }
  )

  app.get(
    '/subscriptions',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'List subscriptions',
        querystring: subscriptionsListQuerySchema,
        response: { 200: paginatedSubscriptionsSchema },
      },
      preHandler: requirePermission('subscriptions', 'view'),
    },
    async (request) => {
      const { data, total } = await service.list(request.query)
      return buildPaginatedResponse(data, total, request.query)
    }
  )

  app.get(
    '/subscriptions/:id',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Get a subscription by id',
        params: z.object({ id: z.string() }),
        response: {
          200: subscriptionSchema,
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('subscriptions', 'view'),
    },
    async (request, reply) => {
      const sub = await service.getById(request.params.id)
      if (!sub)
        return reply.status(404).send({ message: 'Subscription not found' })
      return sub
    }
  )

  app.post(
    '/subscriptions',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Create a subscription',
        body: createSubscriptionSchema,
        response: {
          201: subscriptionSchema,
          400: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('subscriptions', 'create'),
    },
    async (request, reply) => {
      let sub: Awaited<ReturnType<typeof service.create>>
      try {
        sub = await service.create(request.body)
      } catch (error) {
        const code = getPgErrorCode(error)
        if (code === PG_FOREIGN_KEY_VIOLATION) {
          return reply.status(400).send({ message: 'User not found' })
        }
        if (code === PG_UNIQUE_VIOLATION) {
          return reply.status(409).send({ message: LIVE_SUBSCRIPTION_CONFLICT })
        }
        throw error
      }
      await request.audit('create', 'subscriptions', sub.id, request.body)
      return reply.status(201).send(sub)
    }
  )

  app.patch(
    '/subscriptions/:id',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Update a subscription',
        params: z.object({ id: z.string() }),
        body: updateSubscriptionSchema,
        response: {
          200: subscriptionSchema,
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('subscriptions', 'edit'),
    },
    async (request, reply) => {
      let sub: Awaited<ReturnType<typeof service.update>>
      try {
        sub = await service.update(request.params.id, request.body)
      } catch (error) {
        if (getPgErrorCode(error) === PG_UNIQUE_VIOLATION) {
          return reply.status(409).send({ message: LIVE_SUBSCRIPTION_CONFLICT })
        }
        throw error
      }
      if (!sub)
        return reply.status(404).send({ message: 'Subscription not found' })
      await request.audit(
        'edit',
        'subscriptions',
        request.params.id,
        request.body
      )
      return sub
    }
  )

  app.delete(
    '/subscriptions/:id',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Delete a subscription',
        params: z.object({ id: z.string() }),
        response: { 204: z.null().describe('Subscription deleted') },
      },
      preHandler: requirePermission('subscriptions', 'delete'),
    },
    async (request, reply) => {
      await service.remove(request.params.id)
      await request.audit('delete', 'subscriptions', request.params.id)
      return reply.status(204).send(null)
    }
  )
}
