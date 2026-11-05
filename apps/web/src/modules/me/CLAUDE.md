# me module — frontend

Profile self-service module. No list/create/detail/edit split. It has one layout (`/me`) with sidebar navigation to independent sub-pages. No `beforeLoad` permission guard: the routes only require authentication.

## File structure

```
src/modules/me/
├── types.ts
├── validation.ts
├── validation.test.ts
├── linked-accounts.ts             ← linkedAccountsQuery (shared accounts query)
├── components/
│   ├── email-change-form.tsx      ← new email (+ current password when the account has one)
│   ├── password-section.tsx       ← change password, or set a first one (social-only users)
│   ├── sign-in-methods.tsx        ← linked accounts + link another provider
│   └── sign-in-methods.test.tsx
└── routes/
    ├── index.ts
    ├── me-pending.tsx
    ├── me-page.tsx                ← layout with sidebar nav
    ├── me-page.test.tsx           ← tests for MePage, MeAccount + MeSecurity (password section)
    ├── me-account.tsx             ← name form + email change form
    ├── me-security.tsx            ← PasswordSection + SignInMethods
    ├── me-preferences.tsx         ← language, dark mode, sidebar toggle
    ├── me-preferences.test.tsx
    ├── me-subscription.tsx        ← subscription status view (only when subscriptions are enabled)
    └── me-subscription.test.tsx
```

No `hooks.ts`. The three components live in `components/` because they are sections of a page (`MeAccount`, `MeSecurity`), not reusable fields.

## Routes (`routes/index.ts`)

| Path | Component | Notes |
|---|---|---|
| `/me` | `MePage` | Layout shell. The `/me` index route redirects to `/me/account` |
| `/me/account` | `MeAccount` | Name update + email change |
| `/me/security` | `MeSecurity` | Password (change or set) + sign-in methods (linked accounts) |
| `/me/preferences` | `MePreferences` | Language picker, dark mode, sidebar toggle |
| `/me/subscription` | `MeSubscription` | Subscription status view. `beforeLoad` redirects to `/me/account` when subscriptions are disabled |

No permission check on any route. No `loaderDeps`, no `validateSearch`.

Loader on `meRoute`: `queryClient.ensureQueryData(getMeSuspenseQueryOptions())`.

## `MePage` (`routes/me-page.tsx`)

Layout: a `PageView` titled "Account settings" with a `PageTabs` (one underlined tab per sub-page) at the bottom of its header, and the `<Outlet />` as content. Each sub-page returns `FormSection`s (title + description on the left, fields and their own Save button on the right); the subscription sub-page shows its data as `LabeledValue`s in a two-column `SimpleGrid`. It calls `useSubscription()` and renders the Subscription tab only when `enabled` is `true`. That hides the link, and the `meSubscriptionRoute` `beforeLoad` blocks direct URL access when the feature is off.

## Types (`types.ts`)

| Alias | Source |
|---|---|
| `UpdateMeInput` | `PatchMeMutationRequest` from `@helix/api-client/types` |
| `UpdateMeEmailInput` | `PatchMeEmailMutationRequest` |
| `UpdateMePasswordInput` | `PatchMePasswordMutationRequest` |

Form-specific interfaces (not from the API):

```ts
interface MeFormValues { name: string }

interface EmailChangeFormValues { newEmail: string; currentPassword: string }

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string  // frontend-only, not sent to the API
}

interface SetPasswordFormValues {
  newPassword: string
  confirmPassword: string  // frontend-only
}
```

**`LinkedAccount`** is the shape returned by `authClient.listAccounts()`:

```ts
interface LinkedAccount {
  id: string
  providerId: string  // "credential" | "google" | "facebook" | "apple"
  accountId: string
  createdAt: Date
  scopes?: string[] | null
}
```

`providerId === "credential"` means the user has an email/password. OAuth accounts carry the provider name. A user can have several accounts, one per auth method.

## Validation (`validation.ts`)

**`meFormValidate`**: `name` is required.

**`createEmailChangeFormValidate(currentEmail, requirePassword = false)`**: a factory, not a static export. It rejects empty, non-email, or same-as-current values, and an empty `currentPassword` when `requirePassword`.

**`passwordFormValidate`**: `currentPassword` is required, `newPassword` needs at least 8 characters, `confirmPassword` must match.

**`setPasswordFormValidate`**: `newPassword` needs at least 8 characters, `confirmPassword` must match. No `currentPassword`, because this form is for users without a credential account.

## `MeAccount` (`routes/me-account.tsx`)

Two independent forms:

- **Name**: `patchMe({ name })`. `onSuccess` writes the result to the cache with `setQueryData(getMeSuspenseQueryKey(), ...)` and notifies.
- **Email change**: `<EmailChangeForm>` (`components/email-change-form.tsx`), mounted once `linkedAccountsQuery` resolves (a `Loader` before): with a password (`credential` account) it also asks for the current password — the API requires it (`apps/api/src/modules/me/CLAUDE.md` → _Re-authentication_) — and sends `{ newEmail, currentPassword }`; a social-only account sends `{ newEmail }`. It is a separate component because `useForm` keeps the validation it was created with, and that depends on the accounts. `patchMeEmail` sends a verification link to the new address and a notice to the current one; the email changes only after the link is clicked. On success the screen shows a pending notice for the new address (`emailChangePending` is component-local state, so it resets on unmount). Errors go through `apiErrorMessage(error, 'me', 'account.email.notifications.emailFailed')`: `errors.invalid_password`, `errors.current_password_required`, `errors.too_many_attempts`. An address that already has an account gets the same success as a free one (the API never says which) — so the pending notice shows either way.

## `MeSecurity` (`routes/me-security.tsx`)

Renders `<PasswordSection />` then `<SignInMethods />` (two `FormSection`s, no line between them). No logic of its own.

### Shared accounts query

`PasswordSection`, `SignInMethods` and `MeAccount` read the user's linked accounts with one query, `useQuery(linkedAccountsQuery)` (`linked-accounts.ts`, key `['me', 'accounts']`), so React Query makes one request. It calls `authClient.listAccounts()` directly, not the generated api-client, and throws on `{ error }` (Better Auth returns it instead of throwing).

### `PasswordSection` (`components/password-section.tsx`)

Derives `hasPassword = accounts.some(a => a.providerId === 'credential')` and renders one of three states:

- **Loading** (`accountsLoading`): a `<Loader>`.
- **`hasPassword`**: the change-password form (current, new, confirm). Mutation `patchMePassword`. On success it resets the form and notifies. On error it notifies `apiErrorMessage(error, 'me', 'security.notifications.incorrectCurrent')` — `errors.too_many_attempts` after repeated wrong passwords.
- **No password** (social-only user): the set-password form (new + confirm). Mutation `postMeSetPassword`. On success it resets the form, notifies, and invalidates `linkedAccountsQuery.queryKey`, so `hasPassword` flips to `true` and the change form appears without a reload.

The section description also switches between the two cases.

### `SignInMethods` (`components/sign-in-methods.tsx`)

Two queries: the shared accounts query above and the providers query.

**Providers query**: calls the generated `getMeProviders()` fetcher (`GET /me/providers`). Always wrap it in an arrow function. Passing it directly makes TanStack Query hand its context object over as the `config` argument:

```ts
const { data: { providers: availableProviders = [] } = {}, isError: providersError } = useQuery({
  queryKey: ['me', 'providers'],
  queryFn: () => getMeProviders(),   // NOT queryFn: getMeProviders
})
```

**Connected accounts**: lists every account in `accounts`. `PROVIDER_ICONS` maps known `providerId` values to an icon, and labels come from `signIn.providers.<id>` in the `me` namespace. Unknown providers fall back to `IconKey` and their raw `providerId`. The list shows an error `Alert` if `accountsError`, a loading text while pending, and an empty text when there are no accounts.

**Link another account**: shown only when `!providersError && unlinkableProviders.length > 0`:

```ts
const linkedProviderIds = new Set(accounts.map(a => a.providerId))
const unlinkableProviders = availableProviders.filter(p => !linkedProviderIds.has(p))
```

`availableProviders` is empty in closed registration mode (the API returns `[]` — closed mode is email/password only), so the section disappears there; in open mode it lists every enabled provider. Each row has a Connect button. While one provider is linking, the other buttons are disabled:

```ts
async function handleLink(provider: string) {
  setLinkingProvider(provider)
  try {
    const { error } = await authClient.linkSocial({
      provider: provider as 'google' | 'facebook' | 'apple',
      callbackURL: window.location.origin + '/me/security',
    })
    if (error) throw error   // Better Auth may return an error without throwing
  } catch {
    notify({ status: 'danger', message: t('signIn.errors.couldNotLink') })
  } finally {
    setLinkingProvider(null)
  }
}
```

`linkSocial` triggers a full browser redirect on success, like `signIn.social`. `callbackURL` must be absolute (`window.location.origin + '/me/security'`) so Better Auth redirects to the frontend, not the API server. When the user comes back, the accounts query refetches on mount (default `staleTime: 0`).

## `MePreferences` (`routes/me-preferences.tsx`)

Three settings, none of them sent to the API:

- **Language**: `<LanguagePicker languages={appConfig.i18n.languages} />` (languages come from `src/config/app.ts`).
- **Dark mode**: a `Switch` bound to `useMantineColorScheme()`.
- **Hide sidebar**: a `Switch` bound to `useSidebarPreference()` from `src/lib/sidebar-preference.tsx`. That context is provided by `App`, so `MePreferences` throws if rendered outside it. A test must wrap it in `SidebarPreferenceContext.Provider`.

## `MeSubscription` (`routes/me-subscription.tsx`)

A read-only view of the current user's subscription. It uses `useSubscription()` from `src/modules/subscriptions/hooks/use-subscription`, plus `useSubscriptionAccess().graceEndsAt` (from `GET /me/entitlements`) for the past_due warning, and has no mutations. Status changes come from payment webhooks, and plan management lives in the admin `/subscriptions` section.

- `<Loader>` while `isPending` (status or subscription fetching)
- "No active subscription" when `subscription` is `null`
- Otherwise: plan name (`plan?.name`, falling back to the raw `planId`), status badge (`StatusBadge` with `SUBSCRIPTION_STATUS_TONES`), trial end date (only when `trialEndsAt` is set), period start and end; a "payment failed" `Alert` while past_due within the grace period
- In both cases, a **Plans** section (`<section aria-labelledby>`, so tests find it with `getByRole('region', { name: 'Plans' })`) renders `<PlanCatalog>` from the subscriptions module: every plan with what it includes, the current one highlighted. Its description ("contact an administrator…") is the placeholder for a checkout call to action

Dates use `formatDate` from `@/utils/date`, never the `date-fns` function of the same name.

**i18n:** uses the `subscription` namespace under `me.*` keys, shared with the admin module.

## Tests

| File | Covers | Wrapper |
|---|---|---|
| `routes/me-page.test.tsx` | `MePage` (nav links, Subscription link only when enabled), `MeAccount` (name; email change with/without the current password, wrong password) and `MeSecurity`'s password section (change + set, lockout message). `afterEach` runs `notifications.clean()` | `MantineProvider` + `<Notifications />` + `QueryClientProvider`. `MeSecurity` also needs `MantineEmotionProvider` because `SignInMethods` uses `createStyles`. The file stubs `Outlet` and `NavigationItem` (both need a router) for `MePage` |
| `routes/me-preferences.test.tsx` | Language switch, dark mode, sidebar toggle, error outside the context | `MantineProvider` + `SidebarPreferenceContext.Provider` with a `vi.fn()` toggle. `afterEach` restores `i18n` to `en` and clears the color scheme, which are global |
| `components/sign-in-methods.test.tsx` | Connected accounts, link-another section, `linkSocial` errors | `MantineProvider` + `MantineEmotionProvider` + `<Notifications />` + `QueryClientProvider` |
| `routes/me-subscription.test.tsx` | Loading, empty state, plan fallback, badge, dates, past_due warning, plan catalog (current plan, no-subscription case) | `MantineProvider` + `MantineEmotionProvider` (for `LabeledValue`) + `QueryClientProvider` |
| `validation.test.ts` | `meFormValidate`, `createEmailChangeFormValidate`, `passwordFormValidate` | none |

`setPasswordFormValidate` is only covered indirectly by the set-password tests in `me-page.test.tsx`.

### Mocking `authClient`

The accounts query and `linkSocial` call `authClient` directly, so the tests mock it with hoisted functions:

```ts
const { mockListAccounts, mockLinkSocial } = vi.hoisted(() => ({
  mockListAccounts: vi.fn(),
  mockLinkSocial: vi.fn(),
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    useSession: () => ({ data: { user: { ... } }, isPending: false }),
    listAccounts: mockListAccounts,
    linkSocial: mockLinkSocial,
  },
}))
```

`vi.clearAllMocks()` in `afterEach` resets call counts but **not** return values, so set `mockListAccounts` again in `beforeEach`. Use `{ data: [credentialAccount], error: null }` for a user with a password, or `{ data: [], error: null }`. To test the `accountsError` branch, return `{ data: null, error: { message: '...' } }`.

`getMeProviders` and `postMeSetPassword` go through MSW (see the handler table below). Override the providers handler per test for the link-another section.

### Key assertions

- Wait for both queries in `SignInMethods` before asserting absence. `await screen.findByText('Email & password')` proves the accounts resolved. Then wrap the absence assertion in `waitFor` so the providers query settles too.
- Use `findAllByRole` (async), not `getAllByRole`, for Connect buttons: the providers query resolves after the accounts query.

## Handlers for `me` endpoints

| Endpoint | Handler | Default response |
|---|---|---|
| `GET /me/providers` | `getMeProvidersHandler` | `{ providers: [] }` |
| `POST /me/set-password` | `postMeSetPasswordHandler` | `204` |
| `GET /me/subscription` | `getMeSubscriptionHandler` | `204` (no subscription) |
| `GET /me/entitlements` | `getMeEntitlementsHandler` | No subscription (`subscribed: false`, `graceEndsAt: null`) |
