import type { Config } from '@/config'
import type { Database } from '@/db'
import { getPgErrorCode, PG_FOREIGN_KEY_VIOLATION } from '@/lib/pg-errors'
import { type AuditRecorder, systemActor } from '@/modules/audit/audit-recorder'
import { isKnownPlan } from '@/modules/subscriptions/subscription-plans'
import { createSubscriptionsService } from '@/modules/subscriptions/subscriptions-service'
import type { FastifyTypedInstance } from '@/types'

import {
  type BillingWebhookAdapter,
  BillingWebhookPayloadError,
  type BillingWebhookRequest,
} from './billing-webhook-types'

/**
 * `POST /webhooks/billing` — receives payment processor events and syncs the
 * `subscriptions` table through the registered adapter.
 *
 * Public (no session): authenticity comes from `adapter.verify`. Registered by
 * app.ts only when subscriptions are enabled and an adapter is configured in
 * src/config/billing-webhook.ts. Hidden from the OpenAPI spec — no client
 * should call it.
 *
 * Responses follow what processors expect:
 * - 200 — processed, or deliberately skipped (unknown plan/user: logged,
 *   retrying would not help)
 * - 401 — signature rejected
 * - 400 — malformed payload (`BillingWebhookPayloadError`)
 * - 500 — anything else; the processor retries later
 */
export async function billingWebhookRoutes(
  app: FastifyTypedInstance,
  {
    database,
    config,
    adapter,
    audit,
  }: {
    database: Database
    config: Config
    adapter: BillingWebhookAdapter
    audit: AuditRecorder
  }
) {
  const service = createSubscriptionsService(database)

  // Signatures are computed over the exact bytes sent, so keep the raw body
  // (any content type) instead of letting Fastify parse it. Scoped to this
  // plugin only.
  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  app.post(
    '/webhooks/billing',
    { schema: { hide: true } },
    async (request, reply) => {
      const webhookRequest: BillingWebhookRequest = {
        headers: request.headers,
        rawBody: Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0),
      }
      const log = request.log.child({ billingAdapter: adapter.name })

      if (!(await adapter.verify(webhookRequest))) {
        log.warn('Billing webhook rejected: invalid signature')
        return reply.status(401).send({ message: 'Invalid signature' })
      }

      let states: Awaited<ReturnType<BillingWebhookAdapter['parse']>>
      try {
        states = await adapter.parse(webhookRequest)
      } catch (error) {
        if (error instanceof BillingWebhookPayloadError) {
          log.warn({ err: error }, 'Billing webhook rejected: bad payload')
          return reply.status(400).send({ message: error.message })
        }
        throw error
      }

      for (const state of states) {
        const context = { externalId: state.externalId, planId: state.planId }

        if (!isKnownPlan(config.subscriptions.plans, state.planId)) {
          log.error(
            context,
            'Billing webhook skipped: planId is not in subscriptions.plans — map the processor price to a plan id in the adapter'
          )
          continue
        }

        let result: Awaited<ReturnType<typeof service.syncFromBilling>>
        try {
          result = await service.syncFromBilling(state)
        } catch (error) {
          if (getPgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
            log.error(
              { ...context, userId: state.userId },
              'Billing webhook skipped: userId does not exist'
            )
            continue
          }
          throw error
        }

        if (!result) {
          log.error(
            context,
            'Billing webhook skipped: new subscription without userId — attach the user id when creating the checkout on the processor'
          )
          continue
        }

        await audit.record(
          systemActor(adapter.name, `Billing webhook (${adapter.name})`, {
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          }),
          {
            action: result.created ? 'create' : 'edit',
            resource: 'subscriptions',
            resourceId: result.subscription.id,
            metadata: { source: 'billing-webhook', ...state },
          }
        )
      }

      return { received: true }
    }
  )
}
