# subscriptions module — frontend

This module is the single home for everything subscription-related in the frontend: shared hooks, the guard component, and the admin CRUD screens.

- **Hooks** — `useSubscription`, consumed across the app
- **Components** — `RequiresSubscription` guard + admin form fields
- **Admin routes** — operator-facing CRUD for managing subscriptions manually

The admin routes are **only accessible when `SUBSCRIPTION_MODE=enabled`**. The hooks and guard component work in both modes — they return safe defaults (`enabled: false`, `subscription: null`) when the feature is disabled.

---

## File structure

```
src/modules/subscriptions/
├── types.ts
├── validation.ts
├── hooks/
│   └── use-subscription.ts           ← reads status + user subscription in one hook
├── components/
│   ├── requires-subscription.tsx     ← conditional render guard (like HasPermission)
│   └── subscriptions-form.tsx        ← shared admin form fields (create + edit)
└── routes/
    ├── index.ts                      ← route constants + combined array
    ├── subscriptions-pending.tsx
    ├── subscriptions-list.tsx
    ├── subscriptions-create.tsx
    ├── subscriptions-edit.tsx
    └── subscriptions-detail.tsx
```

---

## Hooks (`hooks/`)

### `useSubscription()`

The single hook for all subscription state. Internally fetches both `GET /subscription/status` (cached with `staleTime: Infinity`) and `GET /me/subscription` (only when enabled).

```ts
const { subscription, isActive, isTrialing, isPending, enabled } = useSubscription()
```

**Returns:**
- `enabled: boolean` — `true` when `SUBSCRIPTION_MODE=enabled` on the server
- `subscription: Subscription | null` — active/trialing subscription, or `null`
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

<RequiresSubscription fallback={<UpgradePrompt />}>
  <PremiumFeature />
</RequiresSubscription>
```

- **`children`** — rendered when user has `status: 'active'` or `'trialing'`, or when `enabled=false`
- **`fallback`** — rendered when user has no active subscription; defaults to `null`

**When `enabled=false`:** always renders children. Safe to add to components now and enable enforcement later.

**Implementation:** calls `useSubscription()` only — no separate `useSubscriptionMode()` call needed, since `enabled` is already on the `useSubscription()` return value.

### `subscriptions-form.tsx`

Shared form fields for the admin create and edit screens. See _Form component_ section below.

---

## Types (`types.ts`)

| Alias | Source (`@helix/api-client/types`) |
| --- | --- |
| `SubscriptionItem` | `Subscription` |
| `SubscriptionStatus` | `SubscriptionStatusEnumKey` |
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
  externalId: string | null
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

All four `beforeLoad` hooks:
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

Shared between create and edit. Accepts `isEditing?: boolean` — when `true`, the `userId` field is hidden (can't change the owner of a subscription after creation).

Fields rendered:
- `userId` — `TextInput`, required, hidden when `isEditing`
- `planId` — `TextInput`, required (free-form; app defines valid values)
- `status` — `Select` with all five status values (`active`, `trialing`, `canceled`, `past_due`, `expired`)
- `currentPeriodStart` — `DateInput`, required
- `currentPeriodEnd` — `DateInput`, required
- `trialEndsAt` — `DateInput`, optional, `clearable`
- `externalId` — `TextInput`, optional

All `DateInput` fields bind `value` and `onChange` manually (not via `getInputProps`) because `DateInput`'s `onChange` returns `DateStringValue | null` (a string, not `Date`). The form stores ISO strings and converts with `date ? new Date(date).toISOString() : null`.

---

## List screen (`subscriptions-list.tsx`)

- `DataTable` with pagination and sorting (no filters — not needed for an ops tool)
- Status column renders a colored `Badge` using the `STATUS_COLORS` map
- `currentPeriodEnd` column renders `new Date(value).toLocaleDateString()`
- Actions column: View (always), Edit (behind `subscriptions:edit`), Delete (behind `subscriptions:delete`)
- Empty state shows "No subscriptions yet" with a Create button (behind `subscriptions:create`)

---

## Create screen (`subscriptions-create.tsx`)

- `useForm<SubscriptionFormValues>` with default `status: 'active'`, `currentPeriodStart: now`, `currentPeriodEnd: now + 30d`, `trialEndsAt: null`, `externalId: null`
- Mutation: `postSubscriptions(...)` → invalidates `getSubscriptionsSuspenseQueryKey()` on success
- On 400 from the API (invalid `userId`) the mutation's `onError` fires and shows a danger notification

---

## Edit screen (`subscriptions-edit.tsx`)

- Pre-fills form from `useGetSubscriptionsIdSuspense(id)`
- `SubscriptionsForm` rendered with `isEditing` — `userId` field hidden
- Mutation: `patchSubscriptionsId(id, ...)` → invalidates list + `setQueryData` on item cache
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
- Shows plan ID, status badge (colored by `STATUS_COLORS`), trial end date (when `trialEndsAt` is set), period start/end when a subscription exists

**Navigation:** the tab only appears in `MePage`'s sidebar when `enabled: true`. `MePage` calls `useSubscription()` and conditionally renders the `NavigationItem` based on the `enabled` flag. The route itself (`meSubscriptionRoute`) is always registered — there is no mode guard on `beforeLoad`, because the tab simply shows "no subscription" when the feature is enabled but the user has no subscription. If the feature is disabled the tab is hidden from navigation via `enabled: false`.

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

The `requiresSubscriptionEnabled: true` flag causes `app.tsx` to hide this item when `SUBSCRIPTION_MODE=disabled`. The filtering logic in `app.tsx`:

```ts
.filter((item) => {
  if (item.requiresSubscriptionEnabled && !subscriptionEnabled) return false
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
getSubscriptionStatusHandler(() => getSubscriptionStatusHandlerResponse200({ enabled: true }))
// Provide subscription mode to allow subscriptions list to render
getMeSubscriptionHandler(() => getMeSubscriptionHandlerResponse204())
```
