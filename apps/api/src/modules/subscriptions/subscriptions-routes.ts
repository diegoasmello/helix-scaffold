import z from 'zod'

import type { Config } from '@/config'
import type { Database } from '@/db'
import { DomainError, errorSchema } from '@/lib/domain-errors'
import { buildPaginatedResponse } from '@/lib/pagination'
import {
  getPgErrorCode,
  getPgErrorConstraint,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '@/lib/pg-errors'
import type { FastifyTypedInstance, RequirePermission } from '@/types'

import { createEntitlementsService } from './entitlements'
import {
  entitlementsSchema,
  paginatedSubscriptionsSchema,
  subscriptionBodySchemas,
  subscriptionSchema,
  subscriptionsListQuerySchema,
} from './subscriptions-schema'
import { createSubscriptionsService } from './subscriptions-service'

/**
 * The database errors a client can act on, as `DomainError`s: an unknown
 * `userId` (400 `user_not_found`) and the two unique indexes, told apart by
 * name (409 `live_subscription_exists` / `external_id_taken`).
 */
function toDomainError(error: unknown): unknown {
  const code = getPgErrorCode(error)
  if (code === PG_FOREIGN_KEY_VIOLATION) {
    return new DomainError(400, 'user_not_found', 'User not found')
  }
  if (code !== PG_UNIQUE_VIOLATION) return error
  return getPgErrorConstraint(error) === 'subscriptions_external_id_unique'
    ? new DomainError(
        409,
        'external_id_taken',
        'External ID is already used by another subscription'
      )
    : new DomainError(
        409,
        'live_subscription_exists',
        'User already has an active or trialing subscription'
      )
}

const conflictSchema = errorSchema(
  'live_subscription_exists',
  'external_id_taken'
)

export async function subscriptionsRoutes(
  app: FastifyTypedInstance,
  {
    database,
    config,
    requirePermission,
  }: {
    database: Database
    config: Config
    requirePermission: RequirePermission
  }
) {
  const service = createSubscriptionsService(database)
  const entitlementsService = createEntitlementsService(
    database,
    config.subscriptions
  )
  const bodies = subscriptionBodySchemas(config.subscriptions.plans)

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
      const sub = await service.getAccessGrantingByUserId(
        request.sessionUser.id,
        { pastDueGraceDays: config.subscriptions.pastDueGraceDays }
      )
      if (!sub) return reply.status(204).send(null)
      return sub
    }
  )

  app.get(
    '/me/entitlements',
    {
      schema: {
        operationId: 'getMeEntitlements',
        tags: ['subscriptions'],
        description:
          'What the current user may use: the same decision requireSubscription() enforces',
        response: { 200: entitlementsSchema },
      },
    },
    async (request) => entitlementsService.forUser(request.sessionUser)
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
        body: bodies.create,
        response: {
          201: subscriptionSchema,
          400: errorSchema('user_not_found'),
          409: conflictSchema,
        },
      },
      preHandler: requirePermission('subscriptions', 'create'),
    },
    async (request, reply) => {
      const sub = await service.create(request.body).catch((error) => {
        throw toDomainError(error)
      })
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
        body: bodies.update,
        response: {
          200: subscriptionSchema,
          404: z.object({ message: z.string() }),
          409: conflictSchema,
        },
      },
      preHandler: requirePermission('subscriptions', 'edit'),
    },
    async (request, reply) => {
      const sub = await service
        .update(request.params.id, request.body)
        .catch((error) => {
          throw toDomainError(error)
        })
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
      // 204 either way (idempotent), but only a real deletion is audited
      if (await service.remove(request.params.id)) {
        await request.audit('delete', 'subscriptions', request.params.id)
      }
      return reply.status(204).send(null)
    }
  )
}
