import type { BillingWebhookAdapter } from '@/modules/billing-webhook/billing-webhook-types'

// ─────────────────────────────────────────────
// Payment processor integration.
//
// `null` (default): POST /webhooks/billing is not registered.
// Set an adapter to receive the processor's webhooks and keep the
// `subscriptions` table in sync. Requires subscriptions.enabled = true.
//
// Quick start with the reference adapter (signed JSON in the scaffold's own
// format) — add BILLING_WEBHOOK_SECRET to src/env.ts and .env first:
//
//   import { env } from '@/env'
//   import { createHmacJsonAdapter } from '@/modules/billing-webhook/hmac-json-adapter'
//
//   export const billingWebhookAdapter: BillingWebhookAdapter | null =
//     createHmacJsonAdapter({ secret: env.BILLING_WEBHOOK_SECRET })
//
// For Stripe, Pagar.me, etc., write an adapter for that processor:
// see src/modules/billing-webhook/CLAUDE.md.
// ─────────────────────────────────────────────

export const billingWebhookAdapter: BillingWebhookAdapter | null = null
