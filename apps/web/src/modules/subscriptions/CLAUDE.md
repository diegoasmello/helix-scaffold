# subscriptions module — frontend

This module is the single home for everything subscription-related in the frontend: shared hooks, the guard component, and the admin CRUD screens.

- **Hooks** — `useSubscription` (state + plan catalog) and `useSubscriptionAccess` (feature gate), consumed across the app
- **Components** — `RequiresSubscription` guard + admin form fields
- **Admin routes** — operator-facing CRUD for managing subscriptions manually

The admin routes are **only accessible when `subscriptions.enabled` is `true`** in the API config. The hooks and guard component work in both modes — they return safe defaults (`enabled: false`, `subscription: null`) when the feature is disabled.

---

## File structure

```
src/modules/subscriptions/
├── types.ts
├── access.ts                         ← hasSubscriptionAccess() — the access rule, shared by hook and router
├── access.test.ts
├── constants.ts                      ← SUBSCRIPTION_STATUS_COLORS
├── validation.ts
├── validation.test.ts
├── hooks/
│   ├── use-subscription.ts           ← reads status (incl. plan catalog) + user subscription
│   ├── use-subscription.test.tsx
│   ├── use-subscription-access.ts    ← hasAccess(feature?) — mirrors the API's requireSubscription()
│   └── use-subscription-access.test.tsx
├── components/
│   ├── requires-subscription.tsx     ← conditional render guard (like HasPermission)
│   ├── requires-subscription.test.tsx
│   ├── subscriptions-form.tsx        ← shared admin form fields (create + edit)
│   └── subscriptions-form.test.tsx
└── routes/
    ├── index.ts                      ← route constants + combined array
    ├── subscriptions-pending.tsx
    ├── subscriptions-list.tsx
    ├── subscriptions-list.test.tsx
    ├── subscriptions-create.tsx
    ├── subscriptions-create.test.tsx
    ├── subscriptions-edit.tsx
    ├── subscriptions-edit.test.tsx
    ├── subscriptions-detail.tsx
    ├── subscriptions-detail.test.tsx
    ├── upgrade-required.tsx          ← /upgrade — where route guards send users whose plan lacks a feature
    └── upgrade-required.test.tsx
```

The hook tests use `renderHook` with a `QueryClientProvider` wrapper. `src/app.test.tsx` also covers the sidebar filtering built on both hooks.

---

## Hooks (`hooks/`)

### `useSubscription()`

The single hook for all subscription state. Internally fetches both `GET /subscription/status` (cached with `staleTime: Infinity`) and `GET /me/subscription` (only when enabled).

```ts
const { subscription, plan, plans, getPlanName, isActive, isTrialing, isPending, enabled } =
  useSubscription()
```

**Returns:**
- `enabled: boolean` — `true` when `subscriptions.enabled` is `true` in `apps/api/src/app.config.ts`
- `plans: SubscriptionPlan[]` — the catalog `{ id, name, features }` from `subscriptions.plans` in the API config (`[]` when disabled)
- `subscription: Subscription | null` — active/trialing subscription, or `null`
- `plan: SubscriptionPlan | null` — the catalog entry for `subscription.planId` (`null` if none, or if the plan was removed from the catalog)
- `getPlanName(planId)` — display name for any plan id; falls back to the raw id for plans no longer in the catalog
- `isActive: boolean` — `subscription.status === 'active'`
- `isTrialing: boolean` — `subscription.status === 'trialing'`
- `isPending: boolean` — `true` while `GET /subscription/status` **or** `GET /me/subscription` is in flight

**When `enabled=false`:** the `GET /me/subscription` query is skipped entirely. The hook makes exactly one HTTP request (`GET /subscription/status`) and returns `subscription: null` with no further cost.

**Loading sequence:** on first render `isPending: true` (status fetching) → status resolves → if `enabled: true`, subscription query fires with `isPending: true` again → subscription resolves with final data. Components that check `isPending` before rendering will correctly show a loader throughout the entire sequence.

**Use `enabled` instead of a separate status check.** Components that only need to know whether the feature is on — like `app.tsx` (sidebar filter) or `me-page.tsx` (subscription nav item) — should also call `useSubscription()` and destructure `enabled`. There is no need for a separate hook:

```ts
// ✅ correct — one hook for everything
const { enabled: subscriptionEnabled } = useSubscription()

// ❌ old pattern — no longer exists
const { enabled } = useSubscriptionMode()
```

### `useSubscriptionAccess()`

```ts
const { hasAccess, isPending } = useSubscriptionAccess()

hasAccess()          // any active/trialing subscription
hasAccess('reports') // ...and the plan lists 'reports' in its features
```

Mirrors `requireSubscription()` in the API so the UI hides exactly what the API would reject: always `true` when subscriptions are disabled, and for users with `subscriptions:view` (operators). `isPending` also waits for the user's permissions, so operators never see a fallback flash. Kept separate from `useSubscription()` because it depends on `useAuth()`.

The rule itself lives in `access.ts` → `hasSubscriptionAccess(state, feature?)`, a pure function also used by the router context (see _Route guards_ below). Change the rule there, never in the callers.

### Route guards (`context.hasSubscriptionAccess`)

`authenticatedRoute.beforeLoad` (`src/routes.ts`) injects `hasSubscriptionAccess(feature?)` next to `hasPermission`. It reads the same queries as `useSubscription()` (`GET /subscription/status`, and `GET /me/subscription` when enabled) through `ensureQueryData`, so it shares the cache and adds no requests. Gate a route by plan feature **before** the permission check — same order as the API:

```ts
beforeLoad: ({ context }) => {
  if (!context.hasSubscriptionAccess('reports'))
    throw redirect({ to: '/upgrade', search: { feature: 'reports' } })
  if (!context.hasPermission('reports', 'view')) throw redirect({ to: '/403' })
},
```

`todos` is the reference: all four routes guard on `'todos'`. Without this guard, typing the URL directly would hit the API's 403 and show the generic error page.

### Importing

Import directly from the file — there is no barrel:

```ts
import { useSubscription } from '../hooks/use-subscription'
// or from a different depth:
import { useSubscription } from '../../subscriptions/hooks/use-subscription'
```

---

## Components (`components/`)

### `<RequiresSubscription>`

Conditional render guard. Mirrors `<HasPermission>` in structure and intent.

```tsx
import { RequiresSubscription } from '../components/requires-subscription'

<RequiresSubscription feature="reports" fallback={<UpgradePrompt />}>
  <PremiumFeature />
</RequiresSubscription>
```

- **`feature`** — optional; when set, the user's plan must list it in `features`
- **`children`** — rendered when `useSubscriptionAccess().hasAccess(feature)` is `true`
- **`fallback`** — rendered otherwise; defaults to `null`. Nothing renders while `isPending`.

**When `enabled=false`:** always renders children. Safe to add to components now and enable enforcement later.

### `subscriptions-form.tsx`

Shared form fields for the admin create and edit screens. See _Form component_ section below.

---

## Types (`types.ts`)

| Alias | Source (`@helix/api-client/types`) |
| --- | --- |
| `SubscriptionItem` | `Subscription` |
| `SubscriptionStatus` | `SubscriptionStatusEnumKey` |
| `SubscriptionPlan` | `SubscriptionPlan` |
| `CreateSubscriptionInput` | `PostSubscriptionsMutationRequest` |
| `UpdateSubscriptionInput` | `PatchSubscriptionsIdMutationRequest` |

`SubscriptionFormValues` is form-specific:

```ts
interface SubscriptionFormValues {
  userId: string           // create only — not editable after creation
  planId: string
  status: SubscriptionStatus
  currentPeriodStart: string    // ISO string; DateInput onChange returns string
  currentPeriodEnd: string
  trialEndsAt: string | null
  externalId: string             // '' when empty — mapped to undefined (create) / null (edit) on submit
}
```

Date fields are stored as ISO strings in the form because Mantine v9's `DateInput.onChange` returns `DateStringValue` (a string), not a `Date` object. On submit they are passed directly to the API body, which accepts them via `z.coerce.date()`.

---

## Validation (`validation.ts`)

```ts
subscriptionFormValidate = createValidator<SubscriptionFormValues>()({
  userId: [required],
  planId: [required],
  status: [required],
  currentPeriodStart: [required],
  currentPeriodEnd: [required],
  // trialEndsAt, externalId — optional, no validator
})
```

---

## Routes (`routes/index.ts`)

| Constant | Path | Permission |
| --- | --- | --- |
| `subscriptionsListRoute` | `/subscriptions` | `subscriptions:view` |
| `subscriptionsCreateRoute` | `/subscriptions/create` | `subscriptions:create` |
| `subscriptionsDetailRoute` | `/subscriptions/$id` | `subscriptions:view` |
| `subscriptionsEditRoute` | `/subscriptions/$id/edit` | `subscriptions:edit` |
| `upgradeRoute` | `/upgrade?feature=<key>` | — (any authenticated user) |

`upgradeRoute` redirects to `/` when subscriptions are disabled or when the user already has access to `feature`. The page (`UpgradeRequired`) says whether the user has no subscription or a plan that lacks the feature, lists the plans that include it (all plans when `feature` is absent), and links to `/me/subscription`. It has no checkout — products with a payment flow replace the `upgrade.contact` hint with their own call to action.

The four admin route `beforeLoad` hooks:
1. Check RBAC permission (throws `/403` if missing)
2. Check subscription mode via `queryClient.ensureQueryData(getSubscriptionStatusQueryOptions())` (redirects to `/` if disabled)

The status check uses the React Query cache (same query key as `useSubscription()`), so navigating between subscription routes makes exactly one HTTP call for the status — not four.

### List route

```ts
validateSearch: z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['planId', 'status', 'currentPeriodEnd', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
```

Loader: `queryClient.ensureQueryData(getSubscriptionsSuspenseQueryOptions(deps))`.

### Detail and Edit routes

Loader: `queryClient.ensureQueryData(getSubscriptionsIdSuspenseQueryOptions(params.id))`.

---

## Form component (`components/subscriptions-form.tsx`)

Shared between create and edit. Receives `plans` (from `useSubscription()` in the route) and `isEditing?: boolean` — when `true`, the `userId` field is hidden (can't change the owner of a subscription after creation).

Fields rendered:
- `userId` — `TextInput`, required, hidden when `isEditing`
- `planId` — `Select` of the catalog (`label: plan.name`), required. On edit, a `planId` no longer in the catalog is appended as an extra option so the form still shows it
- `status` — `Select` with all five status values (`active`, `trialing`, `canceled`, `past_due`, `expired`)
- `currentPeriodStart` — `DateInput`, required
- `currentPeriodEnd` — `DateInput`, required
- `trialEndsAt` — `DateInput`, optional, `clearable`
- `externalId` — `TextInput`, optional

All `DateInput` fields bind `value` and `onChange` manually (not via `getInputProps`) because `DateInput`'s `onChange` returns `DateStringValue | null` (a string, not `Date`). The form stores ISO strings and converts with `date ? new Date(date).toISOString() : null`.

---

## List screen (`subscriptions-list.tsx`)

- `DataTable` with pagination and sorting (no filters — not needed for an ops tool)
- Plan column renders `getPlanName(item.planId)`
- Status column renders a colored `Badge` using the `STATUS_COLORS` map
- `currentPeriodEnd` column renders `new Date(value).toLocaleDateString()`
- Actions column: View (always), Edit (behind `subscriptions:edit`), Delete (behind `subscriptions:delete`)
- Empty state shows "No subscriptions yet" with a Create button (behind `subscriptions:create`)

---

## Create screen (`subscriptions-create.tsx`)

- `useForm<SubscriptionFormValues>` with default `status: 'active'`, `currentPeriodStart: now`, `currentPeriodEnd: now + 30d`, `trialEndsAt: null`, `externalId: ''`
- Mutation: `postSubscriptions(...)` → invalidates `getSubscriptionsSuspenseQueryKey()` on success
- On 400 from the API (invalid `userId`) the mutation's `onError` fires and shows a danger notification
- On **409** (the user already has an active/trialing subscription — one per user, enforced by the API) the notification uses `notifications.alreadyLive` instead of the generic `createFailed`; detected via `ApiError.status`

---

## Edit screen (`subscriptions-edit.tsx`)

- Pre-fills form from `useGetSubscriptionsIdSuspense(id)`
- `SubscriptionsForm` rendered with `isEditing` — `userId` field hidden
- Mutation: `patchSubscriptionsId(id, ...)` → invalidates list + `setQueryData` on item cache
- On **409** (reactivating while the user has another live subscription) the notification uses `notifications.alreadyLive`
- **Setting `status: 'canceled'` without `canceledAt`**: the backend service automatically sets `canceledAt = now()` in this case. The edit form does not expose `canceledAt` directly — if a precise cancellation date is needed, it can be set via the API directly.

---

## Detail screen (`subscriptions-detail.tsx`)

Read-only view of all subscription fields. Shows:
- `userId`, `planId`, `status` (badge), `currentPeriodStart`, `currentPeriodEnd`, `trialEndsAt` (only if set), `canceledAt` (only if set), `externalId` (only if set), `createdAt`

Footer: Back button → `/subscriptions`.

---

## Me-page subscription tab (`src/modules/me/routes/me-subscription.tsx`)

The `/me/subscription` route lives in the `me` module but consumes `useSubscription()` and types from this module. It is a read-only status view — no mutations.

**Behavior:**
- Shows a `<Loader>` while `isPending: true` (status or subscription fetching)
- Shows "No active subscription" when `subscription: null`
- Shows the plan name (`plan?.name`, falling back to the raw `planId`), status badge (colored by `STATUS_COLORS`), trial end date (when `trialEndsAt` is set), period start/end when a subscription exists

**Navigation:** the tab only appears in `MePage`'s sidebar when `enabled: true`. `MePage` calls `useSubscription()` and conditionally renders the `NavigationItem` based on the `enabled` flag. The `meSubscriptionRoute` `beforeLoad` also checks the subscription mode and redirects to `/me/account` when subscriptions are disabled, so direct URL navigation is blocked when the feature is off.

**i18n:** uses the `subscription` namespace under `me.*` keys — the same namespace as the admin module.

---

## Sidebar

```ts
// src/config/sidebar.ts
{
  label: 'nav.subscriptions',
  icon: IconCreditCard,
  to: '/subscriptions',
  permission: { resource: 'subscriptions', action: 'view' },
  requiresSubscriptionEnabled: true,
}
```

The `requiresSubscriptionEnabled: true` flag causes `app.tsx` to hide this item when subscriptions are disabled.

Items gated by plan use `subscriptionFeature` instead — `todos` is the reference:

```ts
{ label: 'nav.todos', to: '/todos', permission: { resource: 'todos', action: 'view' }, subscriptionFeature: 'todos' }
```

The filtering logic in `app.tsx` (which also waits for `useSubscriptionAccess().isPending` before rendering the layout):

```ts
.filter((item) => {
  if (item.requiresSubscriptionEnabled && !subscriptionEnabled) return false
  if (item.subscriptionFeature && !hasAccess(item.subscriptionFeature)) return false
  return item.permission
    ? hasPermission(item.permission.resource, item.permission.action)
    : isAuthenticated
})
```

---

## i18n

Namespace: `subscription` (shared with the me-page subscription tab).

Key sections:
- `title`, `create.title`, `edit.title`, `detail.title`
- `empty.*` — empty state text and CTA button label
- `columns.*` — DataTable column headers
- `form.*` — form field labels and placeholders
- `labels.*` — detail view field labels
- `status.*` — localized status names per status value
- `delete.*` — confirmation modal title and message
- `notifications.*` — success/failure toast messages
- `me.*` — strings used by the `/me/subscription` tab (same namespace)

---

## MSW handlers (tests)

Default handlers in `src/mocks/handlers.ts`:

```ts
getSubscriptionsHandler(createPaginatedSubscriptions({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }))
getSubscriptionsIdHandler(() => getSubscriptionsIdHandlerResponse404({ message: 'Not found' }))
postSubscriptionsHandler(() => postSubscriptionsHandlerResponse201(createSubscription()))
patchSubscriptionsIdHandler(() => patchSubscriptionsIdHandlerResponse404({ message: 'Not found' }))
deleteSubscriptionsIdHandler(() => deleteSubscriptionsIdHandlerResponse204())
```

Integration tests for this module also need:
```ts
// Override subscription status to enabled
getSubscriptionStatusHandler(() => getSubscriptionStatusHandlerResponse200({ enabled: true, plans }))
// Provide subscription mode to allow subscriptions list to render
getMeSubscriptionHandler(() => getMeSubscriptionHandlerResponse204())
```
