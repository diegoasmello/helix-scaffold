# subscriptions module — backend

Subscription infrastructure for products built on the scaffold. Provides the plumbing — data model, status enforcement, admin management — without dictating business logic. Plan names, pricing, trial duration, and payment processor integration are all left to the application.

## Design philosophy

The scaffold provides:
- A `subscriptions` table with generic fields
- A plan catalog in `src/app.config.ts` (`subscriptions.plans`), each plan listing the features it unlocks
- A `requireSubscription(feature?)` preHandler (analogous to `requirePermission()`) that gates routes by active subscription and, optionally, by plan feature
- Admin CRUD routes for manual subscription management
- A user-facing `GET /me/subscription` endpoint
- Optional trial auto-start on registration

The scaffold does **not** provide:
- Pricing, billing intervals or proration (they belong to the payment processor)
- Payment processor integration (webhook handlers are app-level)

---

## Feature flag

All admin routes and `GET /me/subscription` are **only registered when `subscriptions.enabled` is `true`** in `src/app.config.ts`. When `false` (the default), the module has zero overhead — no routes, no DB queries. The `requireSubscription()` hook is always created but returns a no-op preHandler when subscriptions are disabled, so apps can freely decorate routes without worrying about mode.

`GET /subscription/status` is always registered at root scope (unauthenticated), like `GET /registration/status`. It returns `{ enabled, plans, pastDueGraceDays }` and is the single source of truth the frontend reads to decide whether to show subscription UI.

---

## Data model

**Table**: `subscriptions` (`src/db/schema/subscriptions.ts`)

| Column | DB type | Notes |
| --- | --- | --- |
| `id` | `text` PK | UUIDv7, generated at insert |
| `userId` | `text NOT NULL` | FK → `user.id` ON DELETE CASCADE |
| `planId` | `text NOT NULL` | One of `subscriptions.plans[].id` (validated on create/update, not by the DB) |
| `status` | `text NOT NULL` | See status values below |
| `trialEndsAt` | `timestamp` | Null for non-trial subscriptions |
| `currentPeriodStart` | `timestamp NOT NULL` | Start of the current billing period |
| `currentPeriodEnd` | `timestamp NOT NULL` | End of the current billing period |
| `canceledAt` | `timestamp` | Set automatically when status is changed to `'canceled'` |
| `pastDueSince` | `timestamp` | Set automatically when status **becomes** `past_due`, kept while it stays there, cleared when it leaves (admin create/edit and webhook sync). Never accepted from clients. Start of the grace period |
| `externalId` | `text` UNIQUE | Payment processor subscription ID (Stripe, etc.) — the webhook sync key (`subscriptions_external_id_unique`; NULLs don't collide) |
| `metadata` | `jsonb` | Provider-specific data — arbitrary JSON |
| `createdAt` | `timestamp NOT NULL` | `defaultNow()` |
| `updatedAt` | `timestamp NOT NULL` | `$onUpdateFn(() => new Date())` |

**One live subscription per user:** the partial unique index `subscriptions_one_live_per_user` (`user_id WHERE status IN ('active', 'trialing')`) allows at most one active/trialing row per user. Any number of `canceled`/`expired`/`past_due` rows can coexist as history. To change plans, update the live subscription's `planId` (or cancel it first) — do not insert a second live row. Migration `0005` cancels pre-existing duplicates (keeping the most recent) before creating the index.

**`externalId` decides who owns the row:** with an `externalId`, the payment processor is the source of truth and its webhooks update the row. Without one (trial auto-start, admin-created), the scaffold owns it and the expiration job (below) ends it.

### Status values

`status` uses `text.$type<SubscriptionStatus>()` to get TypeScript narrowing without a PostgreSQL enum (which would require a migration to extend).

| Status | Meaning |
| --- | --- |
| `active` | Current, paid subscription |
| `trialing` | In trial period — not yet paid |
| `canceled` | User or admin canceled; `canceledAt` is always set |
| `past_due` | Payment failed; grace period |
| `expired` | Period ended with no renewal |

**The `status` field is the source of truth.** `requireSubscription()` checks `status IN ('active', 'trialing')` — it does not compare dates. Apps are responsible for updating status via payment webhook handlers when billing events occur (renewal, cancellation, payment failure). The trial plan ID is set in `subscriptions.trial.planId` in `src/app.config.ts`.

---

## Permissions config

Resource registered in `src/config/permissions.ts`:

```ts
{ resource: 'subscriptions', label: 'Subscriptions', actions: ['view', 'create', 'edit', 'delete'] }
```

**`subscriptions:view` doubles as the admin bypass flag.** `requireSubscription()` skips the subscription check for any user whose role has `subscriptions:view`. This means operators/admins are never blocked by subscription requirements, which is the correct behavior for internal tools.

---

## API endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/subscription/status` | None | Always available; returns `{ enabled, plans, pastDueGraceDays }` — `plans` is the catalog (id, name, features), `[]` when disabled; `pastDueGraceDays` lets the UI show when a past_due user loses access |
| `GET` | `/me/subscription` | Session | Returns current user's active/trialing subscription or 204 |
| `GET` | `/subscriptions` | `subscriptions:view` | Paginated list of all subscriptions |
| `GET` | `/subscriptions/:id` | `subscriptions:view` | Single subscription |
| `POST` | `/subscriptions` | `subscriptions:create` | Create subscription manually |
| `PATCH` | `/subscriptions/:id` | `subscriptions:edit` | Update subscription |
| `DELETE` | `/subscriptions/:id` | `subscriptions:delete` | Hard delete |

**Important:** all routes except `GET /subscription/status` require `subscriptions.enabled: true` to be registered.

### Plan validation

`planId` on `POST`/`PATCH /subscriptions` is refined against the catalog — an unknown plan returns **400** (`Unknown plan`). The OpenAPI spec keeps `planId` as a plain string, so changing the catalog never requires regenerating `@helix/api-client`; the frontend reads the catalog from `GET /subscription/status`.

Rows whose `planId` was later removed from the catalog keep working: they still satisfy `requireSubscription()` (no feature), but unlock no features.

### `GET /me/subscription`

Returns the subscription that currently grants access to the session user — `active`/`trialing`, or `past_due` still inside the grace period (see `getActiveByUserId` below). Returns **200** with the subscription object when found, **204** when there is none.

The frontend `useSubscription()` hook (`src/modules/subscriptions/hooks/use-subscription.ts`) calls this endpoint and treats 204 as "no subscription."

### `POST /subscriptions` — FK validation

The `userId` field is validated by the DB FK constraint. If the provided `userId` does not refer to an existing user, PostgreSQL raises error code `23503` (FOREIGN_KEY_VIOLATION). The route catches this code specifically and returns **400 `{ message: 'User not found' }`**. All other DB errors re-throw as 500.

Postgres codes are read with `getPgErrorCode(error)` from `src/lib/pg-errors.ts` — Drizzle wraps driver errors, so the code may be on the error or on its `cause`. Never read `error.code` directly.

### `POST` / `PATCH` — one live subscription per user

Both unique indexes raise `23505`; the routes tell them apart with `getPgErrorConstraint()` and return **409 `{ message, code }`**:

| Violated index | When | `code` |
| --- | --- | --- |
| `subscriptions_one_live_per_user` | Creating a live (`active`/`trialing`) subscription for a user who already has one, or reactivating a row while another is live | `live_subscription_exists` |
| `subscriptions_external_id_unique` | Reusing an `externalId` that another subscription has | `external_id_taken` |

The frontend maps `code` to a translated message (`apps/web/src/modules/subscriptions/api-errors.ts`).

### `PATCH /subscriptions/:id` — automatic `canceledAt`

When `status: 'canceled'` is included in the patch body without an explicit `canceledAt`, the service automatically sets `canceledAt = new Date()`. This enforces the domain invariant that a canceled subscription always has a cancellation timestamp.

---

## Service (`subscriptions-service.ts`)

Factory `createSubscriptionsService(database)` returns:

```ts
{
  getActiveByUserId(userId: string, options?: { now?: Date; pastDueGraceDays?: number }): Promise<Subscription | null>
  list(query: SubscriptionsListQuery): Promise<{ data: Subscription[], total: number }>
  getById(id: string): Promise<Subscription | null>
  create(data: CreateSubscriptionInput): Promise<Subscription>
  update(id: string, data: UpdateSubscriptionInput): Promise<Subscription | null>
  remove(id: string): Promise<void>
  expireLapsed(now?: Date): Promise<{ expired: number }>
  getByExternalId(externalId: string): Promise<Subscription | null>
  syncFromBilling(state: BillingSubscriptionState): Promise<{ subscription, created } | null>
}
```

**`getActiveByUserId(userId, { now?, pastDueGraceDays? })`** — the subscription that grants access: `status IN ('active', 'trialing')`, or `past_due` with `pastDueSince` within `subscriptions.pastDueGraceDays` (options default to the current time and the config; tests pass them explicitly). Live rows win over a past_due one, then the most recent. Returns `null` if none qualifies. Period dates are intentionally not checked — status is authoritative; `pastDueSince` only bounds the grace period.

### Past-due grace period

When a payment fails the processor moves the subscription to `past_due` and usually retries the charge for a while before canceling. `subscriptions.pastDueGraceDays` (`src/app.config.ts`, default `0`) decides whether the user keeps access meanwhile: a `past_due` subscription counts as active for that many days after `pastDueSince`. No job is involved — access simply stops qualifying once the window passes. Set it to roughly your processor's retry window. `GET /me/subscription` returns the past_due row while it is in the window, and the frontend shows a "payment failed" warning with the access end date. Migration `0007` backfills `pastDueSince = updatedAt` for rows already past_due.

**`update`** — applies the `canceledAt` auto-set logic before writing to the DB.

**`remove`** — hard delete, no soft delete.

**`expireLapsed`** — sets `status: 'expired'` on scaffold-owned rows (`externalId IS NULL`) whose period ended: `trialing` past `COALESCE(trialEndsAt, currentPeriodEnd)` and `active` past `currentPeriodEnd`. Processor-managed rows are never touched. Tested directly in `subscriptions-service.test.ts` (it has logic of its own).

**`getByExternalId` / `syncFromBilling`** — used by the payment processor webhook. `syncFromBilling` upserts by `externalId` and cancels the user's other live subscription when the new state is live. See `src/modules/billing-webhook/CLAUDE.md` for the semantics and the integration guide.

## Expiration job (`src/server.ts`)

Access is decided by `status`, never by dates, so something must end lapsed subscriptions. For processor-managed rows that is the webhook. For scaffold-owned rows — trials created on sign-up and subscriptions created in the admin panel — no processor knows they exist, so `server.ts` runs `expireLapsed()` once at startup and then every `subscriptions.expiration.intervalHours` (default `1`, in `src/app.config.ts`). It only runs when `subscriptions.enabled` is `true`.

A lapsed subscription keeps access until the next run — up to one interval. Lower the interval if that matters for your product.

---

## `requireSubscription` hook (`src/hooks/require-subscription.ts`)

`createRequireSubscription(database)` returns a `RequireSubscription` function:

```ts
export type RequireSubscription = (feature?: string) => PreHandler
```

- `requireSubscription()` — requires any active/trialing subscription.
- `requireSubscription('reports')` — also requires the subscription's plan to list `'reports'` in `features`.

A feature that no plan declares throws **at route registration**, so a typo stops the API from starting instead of silently locking everyone out. Feature checks live in `src/modules/subscriptions/subscription-plans.ts` (`getPlan`, `isKnownPlan`, `isKnownFeature`, `planHasFeature`).

**Usage in route modules:**

```ts
// In app.ts — receive requireSubscription alongside requirePermission
authenticated.register(featureRoutes, { database, requirePermission, requireSubscription })

// In feature-routes.ts — add to preHandler array
app.get('/feature', {
  preHandler: [requireSubscription('feature'), requirePermission('feature', 'view')],
  // ...
})
```

**Execution order matters.** `requireSubscription()` should run **before** `requirePermission()` so users are informed about the subscription requirement, not a permission denial, when they lack both.

**Behavior matrix:**

| `subscriptions.enabled` | User has `subscriptions:view` | User has active subscription | Result |
| --- | --- | --- | --- |
| `disabled` | Any | Any | Pass (no-op) |
| `enabled` | Yes | Any | Pass (admin bypass) |
| `enabled` | No | Yes, plan includes the feature (or no feature requested) | Pass |
| `enabled` | No | Yes, plan lacks the feature | 403 `Your plan does not include this feature` |
| `enabled` | No | `past_due` within `pastDueGraceDays` of `pastDueSince` | Same as an active subscription (feature still checked) |
| `enabled` | No | No (or `past_due` past the grace period) | 403 `Active subscription required` |

The admin bypass is implemented by calling `permissionsService.hasPermission(roleId, 'subscriptions', 'view')`. Users without a role (`roleId === null`) are never bypassed.

**Reference implementation:** `todos-routes.ts` uses `requireSubscription('todos')` on every route as a working example of how apps gate their features.

---

## Trial auto-start (`src/auth.ts`)

When `registration.mode` is `'open'`, `subscriptions.enabled` is `true` and `subscriptions.trial` is set (all in `src/app.config.ts`), a trialing subscription is automatically created in `databaseHooks.user.create.after` immediately after new user registration.

The trial subscription uses:
- `planId: trial.planId` — from `subscriptions.trial.planId` (set it to match your plan catalog)
- `status: 'trialing'`
- `trialEndsAt` = `now + trial.days` days
- `currentPeriodStart` = `now`
- `currentPeriodEnd` = `now + trial.days` days

**This operation is best-effort.** The INSERT is followed by `.catch(() => {})` so a DB failure does not cause user creation to fail. If the insert silently fails, the user will exist without a trial subscription and will see "no active subscription" on the me-page.

The hook fires for **every** user created through better-auth while `registration.mode` is `'open'` — self sign-up, social sign-up, but also the admin created by `POST /bootstrap` and users created via `POST /users` (both call `auth.api.signUpEmail`). In `closed` mode no trial is ever created. Admins are unaffected in practice (`subscriptions:view` bypasses `requireSubscription()`), but an admin-created user in open mode starts with a trial.

---

## Subscription config (`src/app.config.ts`)

```ts
subscriptions: {
  enabled: true,
  plans: [
    { id: 'starter', name: 'Starter', features: ['todos'] },
    { id: 'pro', name: 'Pro', features: ['todos', 'reports'] },
  ],
  // Auto-starts a trial on self-registration. `false` disables trials.
  trial: { days: 14, planId: 'pro' },
},
```

- **`plans[].id`** is stored on each subscription and sent by your payment processor's webhooks — never rename it once in use.
- **`plans[].features`** are free keys: usually a module name (`'todos'`), sometimes a capability (`'pdf-export'`). They are what `requireSubscription('<feature>')` and the frontend's `<RequiresSubscription feature>` check. Their display names live in the web i18n files (`subscription:features.<key>`), shown by the plan catalog on `/me/subscription`.

Startup fails when `enabled: true` and `plans` is empty, when plan ids repeat, or when `trial.planId` is not in the catalog. A warning is logged if `trial` is set but subscriptions are disabled or registration is closed, since it would have no effect.

---

## Schema (`subscriptions-schema.ts`)

- `subscriptionSchema` — full entity returned by the API; `.meta({ id: 'Subscription' })` so Swagger emits it as a `$ref` and kubb generates a clean `Subscription` type
- `subscriptionPlanSchema` — `{ id, name, features }`, `.meta({ id: 'SubscriptionPlan' })`, used by `GET /subscription/status`
- `createSubscriptionSchema` — `userId`, `planId` (refined against the catalog), `status` (default `'active'`), `currentPeriodStart`, `currentPeriodEnd`, `trialEndsAt?`, `externalId?`, `metadata?`
- `updateSubscriptionSchema` — all fields optional (partial update); `canceledAt` can be explicitly set or auto-derived
- `SUBSCRIPTION_SORT_COLUMNS` — `['planId', 'status', 'currentPeriodEnd', 'createdAt']`; default sort: `createdAt`

---

## Tests (`subscriptions-routes.test.ts`, `subscriptions-service.test.ts`)

Route integration tests against the real test database (`helix_test`).

`cleanupSubscriptions()` truncates the `subscriptions` table between tests. The `cleanupAuth()` call in `afterAll` cascades to subscriptions via the FK.

**Test session setup:** `createTestSession()` in `src/test/helpers.ts` automatically creates an `active` subscription (`planId: 'pro'`, expires 2099) for the test admin user when `config.subscriptions.enabled` is `true` (always the case in tests — see `src/config/test-overrides.ts`). This is required because `todos-routes` (the reference module) uses `requireSubscription('todos')`, and without a subscription the test admin would fail those routes. The test catalog (`src/config/test-overrides.ts`) is `starter` (no features), `pro` and `enterprise` (both `['todos']`), with `trial: false` — independent of the product catalog.

The `requireSubscription (via GET /todos)` block covers the behavior matrix above plus the registration-time error for unknown features. Individual tests that need to verify "no subscription" behavior call `cleanupSubscriptions()` explicitly before the assertion.

**Coverage:**
- `GET /subscription/status` — always 200 with `{ enabled, plans, pastDueGraceDays }`
- `GET /me/subscription` — 204 when no active sub; 200 when active sub exists; 204 when only canceled sub exists
- `GET /subscriptions` — empty list, paginated list with multiple subs
- `GET /subscriptions/:id` — 404 for unknown; 200 for existing
- `POST /subscriptions` — 201 with correct body; 400 for invalid body; 400 for non-existent userId
- `PATCH /subscriptions/:id` — 404 for unknown; 200 with updated fields; unchanged fields persist
- `DELETE /subscriptions/:id` — 204 for existing; 204 for unknown
- Permission enforcement — 403 for each route when session lacks the required grant
