# subscriptions module — backend

Subscription infrastructure for products built on the scaffold. Provides the plumbing — data model, status enforcement, admin management — without dictating business logic. Plan names, pricing, trial duration, and payment processor integration are all left to the application.

## Design philosophy

The scaffold provides:
- A `subscriptions` table with generic fields
- A `requireSubscription()` preHandler (analogous to `requirePermission()`) that gates routes
- Admin CRUD routes for manual subscription management
- A user-facing `GET /me/subscription` endpoint
- Optional trial auto-start on registration

The scaffold does **not** provide:
- Plan definitions or pricing (`planId` is a free-form string apps define)
- Payment processor integration (webhook handlers are app-level)
- Feature flags or entitlements per plan
- Billing cycles or proration logic

---

## Feature flag

All admin routes and `GET /me/subscription` are **only registered when `subscriptions.enabled` is `true`** in `src/app.config.ts`. When `false` (the default), the module has zero overhead — no routes, no DB queries. The `requireSubscription()` hook is always created but returns a no-op preHandler when subscriptions are disabled, so apps can freely decorate routes without worrying about mode.

`GET /subscription/status` is always registered at root scope (unauthenticated), like `GET /registration/status`. It returns `{ enabled: boolean }` and is the single source of truth the frontend reads to decide whether to show subscription UI.

---

## Data model

**Table**: `subscriptions` (`src/db/schema/subscriptions.ts`)

| Column | DB type | Notes |
| --- | --- | --- |
| `id` | `text` PK | UUIDv7, generated at insert |
| `userId` | `text NOT NULL` | FK → `user.id` ON DELETE CASCADE |
| `planId` | `text NOT NULL` | App-defined string — e.g. `'pro'`, `'starter'` |
| `status` | `text NOT NULL` | See status values below |
| `trialEndsAt` | `timestamp` | Null for non-trial subscriptions |
| `currentPeriodStart` | `timestamp NOT NULL` | Start of the current billing period |
| `currentPeriodEnd` | `timestamp NOT NULL` | End of the current billing period |
| `canceledAt` | `timestamp` | Set automatically when status is changed to `'canceled'` |
| `externalId` | `text` | Payment processor subscription ID (Stripe, etc.) |
| `metadata` | `jsonb` | Provider-specific data — arbitrary JSON |
| `createdAt` | `timestamp NOT NULL` | `defaultNow()` |
| `updatedAt` | `timestamp NOT NULL` | `$onUpdateFn(() => new Date())` |

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
| `GET` | `/subscription/status` | None | Always available; returns `{ enabled: boolean }` |
| `GET` | `/me/subscription` | Session | Returns current user's active/trialing subscription or 204 |
| `GET` | `/subscriptions` | `subscriptions:view` | Paginated list of all subscriptions |
| `GET` | `/subscriptions/:id` | `subscriptions:view` | Single subscription |
| `POST` | `/subscriptions` | `subscriptions:create` | Create subscription manually |
| `PATCH` | `/subscriptions/:id` | `subscriptions:edit` | Update subscription |
| `DELETE` | `/subscriptions/:id` | `subscriptions:delete` | Hard delete |

**Important:** all routes except `GET /subscription/status` require `subscriptions.enabled: true` to be registered.

### `GET /me/subscription`

Returns the most recently created subscription with `status IN ('active', 'trialing')` for the current session user. Returns **200** with the subscription object when found, **204** when the user has no active subscription.

The frontend `useSubscription()` hook (`src/modules/subscriptions/hooks/use-subscription.ts`) calls this endpoint and treats 204 as "no subscription."

### `POST /subscriptions` — FK validation

The `userId` field is validated by the DB FK constraint. If the provided `userId` does not refer to an existing user, PostgreSQL raises error code `23503` (FOREIGN_KEY_VIOLATION). The route catches this code specifically and returns **400 `{ message: 'User not found' }`**. All other DB errors re-throw as 500.

### `PATCH /subscriptions/:id` — automatic `canceledAt`

When `status: 'canceled'` is included in the patch body without an explicit `canceledAt`, the service automatically sets `canceledAt = new Date()`. This enforces the domain invariant that a canceled subscription always has a cancellation timestamp.

---

## Service (`subscriptions-service.ts`)

Factory `createSubscriptionsService(database)` returns:

```ts
{
  getActiveByUserId(userId: string): Promise<Subscription | null>
  list(query: SubscriptionsListQuery): Promise<{ data: Subscription[], total: number }>
  getById(id: string): Promise<Subscription | null>
  create(data: CreateSubscriptionInput): Promise<Subscription>
  update(id: string, data: UpdateSubscriptionInput): Promise<Subscription | null>
  remove(id: string): Promise<void>
}
```

**`getActiveByUserId`** — queries for the most recently created subscription where `status IN ('active', 'trialing')`, ordered by `createdAt DESC`, limited to 1. Returns `null` if none exists. Date fields are intentionally not checked — the status field is authoritative.

**`update`** — applies the `canceledAt` auto-set logic before writing to the DB.

**`remove`** — hard delete, no soft delete.

---

## `requireSubscription` hook (`src/hooks/require-subscription.ts`)

`createRequireSubscription(database)` returns a `RequireSubscription` function:

```ts
export type RequireSubscription = () => PreHandler
```

**Usage in route modules:**

```ts
// In app.ts — receive requireSubscription alongside requirePermission
authenticated.register(featureRoutes, { database, requirePermission, requireSubscription })

// In feature-routes.ts — add to preHandler array
app.get('/feature', {
  preHandler: [requireSubscription(), requirePermission('feature', 'view')],
  // ...
})
```

**Execution order matters.** `requireSubscription()` should run **before** `requirePermission()` so users are informed about the subscription requirement, not a permission denial, when they lack both.

**Behavior matrix:**

| `subscriptions.enabled` | User has `subscriptions:view` | User has active subscription | Result |
| --- | --- | --- | --- |
| `disabled` | Any | Any | Pass (no-op) |
| `enabled` | Yes | Any | Pass (admin bypass) |
| `enabled` | No | Yes | Pass |
| `enabled` | No | No | 403 `Active subscription required` |

The admin bypass is implemented by calling `permissionsService.hasPermission(roleId, 'subscriptions', 'view')`. Users without a role (`roleId === null`) are never bypassed.

**Reference implementation:** `todos-routes.ts` uses `requireSubscription()` on every route as a working example of how apps gate their features.

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

Trial auto-start only fires for users created via the self-registration flow. Bootstrap-created admins, and users created via `POST /users` (closed-mode admin creation), do not receive trial subscriptions.

---

## Subscription config (`src/app.config.ts`)

```ts
subscriptions: {
  enabled: true,
  // Auto-starts a trial on self-registration. `false` disables trials.
  trial: { days: 14, planId: 'trial' },
},
```

Set `planId` to whatever planId your app uses for trial users (e.g., `'free-trial'`, `'starter-trial'`). A warning is logged at startup if `trial` is set but subscriptions are disabled or registration is closed, since it would have no effect.

---

## Schema (`subscriptions-schema.ts`)

- `subscriptionSchema` — full entity returned by the API; `.meta({ id: 'Subscription' })` so Swagger emits it as a `$ref` and kubb generates a clean `Subscription` type
- `createSubscriptionSchema` — `userId`, `planId`, `status` (default `'active'`), `currentPeriodStart`, `currentPeriodEnd`, `trialEndsAt?`, `externalId?`, `metadata?`
- `updateSubscriptionSchema` — all fields optional (partial update); `canceledAt` can be explicitly set or auto-derived
- `SUBSCRIPTION_SORT_COLUMNS` — `['planId', 'status', 'currentPeriodEnd', 'createdAt']`; default sort: `createdAt`

---

## Tests (`subscriptions-routes.test.ts`)

Route integration tests against the real `api_test` database.

`cleanupSubscriptions()` truncates the `subscriptions` table between tests. The `cleanupAuth()` call in `afterAll` cascades to subscriptions via the FK.

**Test session setup:** `createTestSession()` in `src/test/helpers.ts` automatically creates an `active` subscription (`planId: 'test'`, expires 2099) for the test admin user when `config.subscriptions.enabled` is `true` (always the case in tests — see `src/config/test-overrides.ts`). This is required because `todos-routes` (the reference module) uses `requireSubscription()`, and without a subscription the test admin would fail those routes. Individual tests that need to verify "no subscription" behavior call `cleanupSubscriptions()` explicitly before the assertion.

**Coverage:**
- `GET /subscription/status` — always 200 with `{ enabled: boolean }`
- `GET /me/subscription` — 204 when no active sub; 200 when active sub exists; 204 when only canceled sub exists
- `GET /subscriptions` — empty list, paginated list with multiple subs
- `GET /subscriptions/:id` — 404 for unknown; 200 for existing
- `POST /subscriptions` — 201 with correct body; 400 for invalid body; 400 for non-existent userId
- `PATCH /subscriptions/:id` — 404 for unknown; 200 with updated fields; unchanged fields persist
- `DELETE /subscriptions/:id` — 204 for existing; 204 for unknown
- Permission enforcement — 403 for each route when session lacks the required grant
