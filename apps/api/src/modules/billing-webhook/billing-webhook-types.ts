import type { IncomingHttpHeaders } from 'node:http'

import type { SubscriptionStatus } from '../subscriptions/subscriptions-schema'

/**
 * One subscription as the payment processor reports it, already translated
 * into the scaffold's vocabulary by the adapter.
 *
 * Optional fields follow "omit to keep": `undefined` leaves the stored value
 * untouched, `null` clears it.
 */
export interface BillingSubscriptionState {
  /** The processor's subscription id. Stored as `externalId` — the sync key. */
  externalId: string
  /**
   * Scaffold user id. Required the first time a subscription is seen (to
   * create the row), ignored afterwards. Usually attached as metadata when
   * your app creates the checkout session on the processor.
   */
  userId?: string
  /**
   * One of `subscriptions.plans[].id` (src/app.config.ts). Map the processor's
   * price/product id to your plan id in the adapter.
   */
  planId: string
  /** Map the processor's statuses (e.g. Stripe's `unpaid`) to these five. */
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
  trialEndsAt?: Date | null
  canceledAt?: Date | null
  /** Provider data worth keeping (customer id, price id, …). */
  metadata?: Record<string, unknown> | null
}

/** What adapters receive. `rawBody` is untouched — signatures are computed over it. */
export interface BillingWebhookRequest {
  headers: IncomingHttpHeaders
  rawBody: Buffer
}

/**
 * The integration point with a payment processor. Implement one per processor
 * and register it in src/config/billing-webhook.ts.
 */
export interface BillingWebhookAdapter {
  /** Short identifier used in logs and audit entries, e.g. `'stripe'`. */
  name: string

  /**
   * Confirms the request comes from the processor — usually by checking a
   * signature header against `rawBody` with a secret from `.env`.
   * Return `false` to reject it with 401.
   */
  verify(request: BillingWebhookRequest): boolean | Promise<boolean>

  /**
   * Translates a verified request into the subscription states to sync.
   * Return `[]` for events you ignore.
   *
   * Prefer fetching the subscription's **current** state from the processor's
   * API over trusting the event payload: webhooks arrive late, out of order
   * and more than once, and syncing current state makes every delivery
   * idempotent.
   *
   * Throw `BillingWebhookPayloadError` for malformed payloads (400, the
   * processor stops retrying). Any other error returns 500 so it retries.
   */
  parse(
    request: BillingWebhookRequest
  ): BillingSubscriptionState[] | Promise<BillingSubscriptionState[]>
}

/** Thrown by `parse` for payloads that will never be valid (responds 400). */
export class BillingWebhookPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BillingWebhookPayloadError'
  }
}
