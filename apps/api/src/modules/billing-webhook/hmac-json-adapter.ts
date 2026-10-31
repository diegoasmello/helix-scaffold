import { createHmac, timingSafeEqual } from 'node:crypto'

import { z } from 'zod'

import { SUBSCRIPTION_STATUSES } from '../subscriptions/subscriptions-schema'
import {
  type BillingWebhookAdapter,
  BillingWebhookPayloadError,
} from './billing-webhook-types'

const payloadSchema = z.object({
  subscriptions: z.array(
    z.object({
      externalId: z.string().min(1),
      userId: z.string().min(1).optional(),
      planId: z.string().min(1),
      status: z.enum(SUBSCRIPTION_STATUSES),
      currentPeriodStart: z.coerce.date(),
      currentPeriodEnd: z.coerce.date(),
      trialEndsAt: z.coerce.date().nullable().optional(),
      canceledAt: z.coerce.date().nullable().optional(),
      metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    })
  ),
})

export interface HmacJsonAdapterOptions {
  /** Shared secret, from `.env`. */
  secret: string
  /** Header carrying `sha256=<hex>`. @default 'x-billing-signature' */
  header?: string
}

/**
 * Reference adapter, for billing systems you control or as a template for a
 * real processor. Expects:
 *
 * - Body: JSON `{ "subscriptions": [BillingSubscriptionState, …] }`, dates
 *   as ISO strings — already in the scaffold's vocabulary.
 * - Header: `x-billing-signature: sha256=<hex HMAC-SHA256 of the raw body>`.
 *
 * Real processors (Stripe, Pagar.me, …) sign differently and send their own
 * payload shape — see src/modules/billing-webhook/CLAUDE.md for how to write
 * an adapter for them.
 */
export function createHmacJsonAdapter(
  options: HmacJsonAdapterOptions
): BillingWebhookAdapter {
  const { secret, header = 'x-billing-signature' } = options

  return {
    name: 'hmac-json',

    verify({ headers, rawBody }) {
      const received = headers[header]
      if (typeof received !== 'string') return false
      const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
      const a = Buffer.from(received)
      const b = Buffer.from(expected)
      // Constant-time comparison so the signature can't be guessed byte by byte.
      return a.length === b.length && timingSafeEqual(a, b)
    },

    parse({ rawBody }) {
      let json: unknown
      try {
        json = JSON.parse(rawBody.toString('utf8'))
      } catch {
        throw new BillingWebhookPayloadError('Body is not valid JSON')
      }
      const parsed = payloadSchema.safeParse(json)
      if (!parsed.success) {
        throw new BillingWebhookPayloadError(z.prettifyError(parsed.error))
      }
      return parsed.data.subscriptions
    },
  }
}
