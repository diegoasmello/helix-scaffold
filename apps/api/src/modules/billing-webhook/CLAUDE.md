# billing-webhook module — backend

Generic entry point for payment processor webhooks (Stripe, Pagar.me, Mercado Pago, an in-house billing system…). The scaffold ships **no processor**: it ships the route, the sync logic and an adapter interface. Integrating a processor means writing one adapter and registering it.

Off by default. `POST /webhooks/billing` exists only when `subscriptions.enabled` is `true` **and** an adapter is set in `src/config/billing-webhook.ts`.

---

## How it fits together

```
Processor ──POST /webhooks/billing──▶ adapter.verify()   signature ok?        no → 401
                                       adapter.parse()    → BillingSubscriptionState[]
                                                           malformed → 400 · other error → 500 (retried)
                                       for each state:
                                         plan in catalog?  user known?        no → logged, skipped
                                         subscriptionsService.syncFromBilling(state)
                                         audit log (system actor "Billing webhook (<adapter>)", via the audit recorder)
                                       200 { received: true }
```

**Who owns a subscription row** — the rule the whole subscription layer follows:

| `externalId` | Owner | Kept up to date by |
| --- | --- | --- |
| set | the payment processor | this webhook |
| `null` | the scaffold (sign-up trial, admin panel) | the expiration job in `server.ts` |

The expiration job never touches rows with an `externalId`, so the processor **must** send an event when a subscription ends (cancellation, non-payment, period end).

---

## Files

| File | Purpose |
| --- | --- |
| `billing-webhook-types.ts` | `BillingWebhookAdapter` (the interface to implement), `BillingSubscriptionState` (normalized state), `BillingWebhookPayloadError` |
| `billing-webhook-routes.ts` | `POST /webhooks/billing` — raw-body parsing, verify → parse → sync → audit, response codes |
| `hmac-json-adapter.ts` | `createHmacJsonAdapter({ secret })` — reference adapter: HMAC-SHA256 signed JSON already in the scaffold's format. Used by the tests; usable as-is for a billing system you control; a template for real processors |
| `billing-webhook-routes.test.ts` | End-to-end route tests through the reference adapter |
| `src/config/billing-webhook.ts` | **The file a product edits**: `export const billingWebhookAdapter = …` (`null` = off) |

Sync logic lives in the subscriptions service: `getByExternalId(externalId)` and `syncFromBilling(state)` (`src/modules/subscriptions/subscriptions-service.ts`).

---

## The contract

### `BillingWebhookAdapter`

```ts
interface BillingWebhookAdapter {
  name: string                                       // 'stripe' — logs + audit actor
  verify(request): boolean | Promise<boolean>        // false → 401
  parse(request): BillingSubscriptionState[] | Promise<…>  // [] → nothing to do
}
// request = { headers: IncomingHttpHeaders, rawBody: Buffer }
```

- **`verify`** — check the processor's signature header against `rawBody` with a secret from `.env`. The route keeps the body as raw bytes (any content type) precisely so signatures can be checked; never re-serialize JSON before verifying.
- **`parse`** — turn the event into the state of the affected subscription(s). **Fetch the subscription's current state from the processor's API** instead of trusting the event payload: deliveries arrive late, out of order and more than once, and syncing current state makes every delivery idempotent and order-independent.
- Errors: throw `BillingWebhookPayloadError` for a payload that will never be valid → **400** (processors stop retrying). Any other error (network, processor API down) → **500**, and the processor retries later.

### `BillingSubscriptionState`

| Field | Notes |
| --- | --- |
| `externalId` | The processor's subscription id — the sync key (unique index `subscriptions_external_id_unique`) |
| `userId?` | Scaffold user id. **Required the first time** a subscription is seen, ignored afterwards. Attach it as metadata when your app creates the checkout on the processor |
| `planId` | Must be one of `subscriptions.plans[].id`. Map the processor's price/product id to it in the adapter |
| `status` | One of `active`, `trialing`, `past_due`, `canceled`, `expired` — map the processor's statuses. Entering `past_due` sets `pastDueSince` (start of `subscriptions.pastDueGraceDays`); leaving it clears it |
| `currentPeriodStart`, `currentPeriodEnd` | `Date` |
| `trialEndsAt?`, `canceledAt?`, `metadata?` | **Omit to keep** the stored value, `null` to clear it |

---

## Sync semantics (`syncFromBilling`)

Runs in a transaction:

1. Looks up the row by `externalId`. Missing and no `userId` → returns `null` (the route logs and skips).
2. If the new status is live (`active`/`trialing`), **cancels the user's other live subscription** (`status: 'canceled'`, `canceledAt: now`). A user has at most one live subscription (`subscriptions_one_live_per_user`), and a paid subscription supersedes the sign-up trial. If the processor later sends the old one's cancellation, it just updates an already-canceled row.
3. Updates the existing row (`userId` never changes) or inserts a new one.

**Skipped, not failed** (HTTP 200, `log.error`): `planId` not in the catalog, unknown `userId`, new subscription without `userId`. Retrying would not fix them; the logs say what to change in the adapter. The other states of the same delivery are still synced.

**Concurrency:** two deliveries creating the same new `externalId` at once can race; the loser hits the unique index → 500 → the processor retries → the retry finds the row and updates it.

---

## Integrating a processor — checklist

1. **Checkout (your app code, not this module).** When creating the processor's checkout/subscription, attach the scaffold `userId` (e.g. Stripe `subscription_data.metadata.userId`) and use the price that corresponds to the plan.
2. **Secrets.** Add the webhook secret (and API key, if `parse` calls the processor's API) to `src/env.ts` and `.env.example`. Never to `app.config.ts`.
3. **Adapter.** Create `src/modules/billing-webhook/adapters/<processor>.ts` implementing `BillingWebhookAdapter` — see the sketch below. Keep the price → plan map next to it.
4. **Register it** in `src/config/billing-webhook.ts`.
5. **Point the processor** at `{BASE_URL}/api/webhooks/billing` and subscribe to the subscription lifecycle events (created, updated, deleted / canceled, payment failed).
6. **Test locally** with the processor's CLI forwarding (e.g. `stripe listen --forward-to localhost:3333/api/webhooks/billing`).
7. **Unit-test the adapter** (signature accepted/rejected, each status mapping, price → plan, ignored events → `[]`). The sync itself is already covered by `billing-webhook-routes.test.ts`.

### Adapter sketch (Stripe-like processor)

Illustrative only — the scaffold does not depend on any SDK. Check your processor's documentation for exact field names (they change between API versions).

```ts
import Stripe from 'stripe'

import { env } from '@/env'
import type {
  BillingSubscriptionState,
  BillingWebhookAdapter,
} from '../billing-webhook-types'
import { BillingWebhookPayloadError } from '../billing-webhook-types'

const stripe = new Stripe(env.STRIPE_SECRET_KEY)

const PLAN_BY_PRICE: Record<string, string> = {
  price_123: 'starter',
  price_456: 'pro',
}

const STATUS: Record<string, BillingSubscriptionState['status'] | null> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  unpaid: 'past_due',
  canceled: 'canceled',
  incomplete_expired: 'expired',
  incomplete: null, // not paid yet — ignore until it becomes active
}

export const stripeAdapter: BillingWebhookAdapter = {
  name: 'stripe',

  verify({ headers, rawBody }) {
    try {
      stripe.webhooks.constructEvent(rawBody, String(headers['stripe-signature']), env.STRIPE_WEBHOOK_SECRET)
      return true
    } catch {
      return false
    }
  },

  async parse({ rawBody }) {
    const event = JSON.parse(rawBody.toString('utf8'))
    if (!event.type?.startsWith('customer.subscription.')) return []

    // Current state, not the event payload — makes deliveries idempotent.
    const sub = await stripe.subscriptions.retrieve(event.data.object.id)
    const status = STATUS[sub.status]
    if (status === undefined) throw new BillingWebhookPayloadError(`Unknown status ${sub.status}`)
    if (status === null) return []

    return [{
      externalId: sub.id,
      userId: sub.metadata.userId,
      planId: PLAN_BY_PRICE[sub.items.data[0].price.id] ?? sub.items.data[0].price.id,
      status,
      currentPeriodStart: /* period start from `sub` */,
      currentPeriodEnd: /* period end from `sub` */,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      metadata: { customer: sub.customer },
    }]
  },
}
```

An unmapped price falls through as its raw id, which the route rejects as "not in subscriptions.plans" with a clear log — better than silently picking a plan.

---

## What this module does not do

- Create checkout sessions, customer portals, invoices, refunds or proration — that is product code talking to the processor's API.
- Store raw events. Idempotency comes from syncing current state; add an events table only if you need an audit trail of deliveries.
- Notify the user (email on payment failure, etc.) — call `emailProvider` from your adapter's caller or a follow-up hook if needed.

---

## Tests

`billing-webhook-routes.test.ts` builds the app with `buildApp(testDb, { billingWebhookAdapter: createHmacJsonAdapter({ secret }) })` — the `billingWebhookAdapter` option overrides `src/config/billing-webhook.ts` — and signs bodies with the same secret. It covers: not registered without an adapter, hidden from the OpenAPI spec, 401/400 paths, create, update, idempotent redelivery, omit-to-keep, superseding the trial, multi-state deliveries, the audit entry, and each skipped case.
