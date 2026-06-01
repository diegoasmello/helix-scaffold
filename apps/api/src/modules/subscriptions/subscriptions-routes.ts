import z from 'zod'

import type { Database } from '@/db'
import { buildPaginatedResponse } from '@/lib/pagination'
import type { FastifyTypedInstance, RequirePermission } from '@/types'

import {
  createSubscriptionSchema,
  paginatedSubscriptionsSchema,
  subscriptionSchema,
  subscriptionsListQuerySchema,
  updateSubscriptionSchema,
} from './subscriptions-schema'
import { createSubscriptionsService } from './subscriptions-service'

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
        },
      },
      preHandler: requirePermission('subscriptions', 'create'),
    },
    async (request, reply) => {
      let sub: Awaited<ReturnType<typeof service.create>>
      try {
        sub = await service.create(request.body)
      } catch (error) {
        const pgError = error as { code?: string }
        if (pgError.code === '23503') {
          return reply.status(400).send({ message: 'User not found' })
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
        },
      },
      preHandler: requirePermission('subscriptions', 'edit'),
    },
    async (request, reply) => {
      const sub = await service.update(request.params.id, request.body)
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
