# me module — frontend

Single-screen module for profile self-service. No list/create/detail/edit split — one layout (`/me`) with sidebar navigation to independent sub-pages. No `beforeLoad` permission guard — the route only requires authentication.

## File structure

```
src/modules/me/
├── types.ts
├── validation.ts
├── validation.test.ts
└── routes/
    ├── index.ts
    ├── me-pending.tsx
    ├── me-page.tsx       ← layout with sidebar nav (Account / Sign-in methods / Security)
    ├── me-account.tsx    ← name form + email change form
    ├── me-sign-in.tsx    ← linked accounts + link provider + set password
    ├── me-security.tsx   ← password change form (for users who already have a password)
    ├── me-page.test.tsx  ← tests for MeAccount + MeSecurity
    └── me-sign-in.test.tsx
```

No `hooks.ts`, no `components/`.

## Routes (`routes/index.ts`)

| Path | Component | Notes |
|---|---|---|
| `/me` | `MePage` | Layout shell; redirects `/me` → `/me/account` |
| `/me/account` | `MeAccount` | Name update + email change |
| `/me/sign-in` | `MeSignIn` | Linked accounts, link new provider, set password for social-only users |
| `/me/security` | `MeSecurity` | Password change (requires current password) |

No `beforeLoad` permission check. No `loaderDeps`, no `validateSearch`.

Loader on `meRoute`: `queryClient.ensureQueryData(getMeSuspenseQueryOptions())`.

## Types (`types.ts`)

| Alias | Source |
|---|---|
| `MeProfile` | `GetMeQueryResponse` from `@helix/api-client/types` |
| `UpdateMeInput` | `PatchMeMutationRequest` |
| `UpdateMeEmailInput` | `PatchMeEmailMutationRequest` |
| `UpdateMePasswordInput` | `PatchMePasswordMutationRequest` |
| `SetPasswordInput` | `PostMeSetPasswordMutationRequest` |

Form-specific interfaces (not from the API):

```ts
interface MeFormValues { name: string }

interface EmailChangeFormValues { newEmail: string }

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string  // frontend-only — not sent to the API
}

interface SetPasswordFormValues {
  newPassword: string
  confirmPassword: string  // frontend-only
}
```

**`LinkedAccount`** — shape returned by `authClient.listAccounts()`:

```ts
interface LinkedAccount {
  id: string
  providerId: string  // "credential" | "google" | "facebook" | "apple"
  accountId: string
  createdAt: Date
  scopes?: string[] | null
}
```

`providerId === "credential"` means the account has an email/password. OAuth accounts have the provider name. A user can have multiple accounts — one per auth method.

## Validation (`validation.ts`)

**`meFormValidate`** — `name`: required.

**`createEmailChangeFormValidate(currentEmail)`** — factory, not a static export. Rejects empty, non-email, or same-as-current values.

**`passwordFormValidate`** — `currentPassword`: required; `newPassword`: min 8; `confirmPassword`: must match.

**`setPasswordFormValidate`** — `newPassword`: min 8; `confirmPassword`: must match. No `currentPassword` — this form is for users without a credential account.

## `MeAccount` (`routes/me-account.tsx`)

Three independent forms rendered as separate `<Stack>` sections:

### Name section
Mutation: `patchMe({ name })` — `onSuccess` updates the cache via `setQueryData` and notifies success.

### Email change section
Mutation: `patchMeEmail({ newEmail })` — sends a verification link. Email changes only after the user clicks the link. `emailChangePending` is component-local state; it resets on unmount.

### (No password section here)
Password management was split into two routes: `MeSecurity` (for users with an existing password) and `MeSignIn` (to set a first password for social-only users).

## `MeSecurity` (`routes/me-security.tsx`)

Password change form: current password + new password + confirm. Mutation: `patchMePassword`. On success: resets the form and notifies. Linked from `MeSignIn` via an `<Anchor>` when the user already has a password set.

## `MeSignIn` (`routes/me-sign-in.tsx`)

The most complex sub-page. Uses two independent queries and has three visual sections.

### Queries

**Accounts query** — calls `authClient.listAccounts()` directly (not via the generated api-client):

```ts
const { data: accounts = [], isPending: accountsLoading, isError: accountsError } = useQuery({
  queryKey: ['me', 'accounts'],
  queryFn: async () => {
    const { data, error } = await authClient.listAccounts()
    if (error) throw error          // Better Auth returns { error } instead of throwing
    return (data ?? []) as LinkedAccount[]
  },
})
```

**Providers query** — calls the generated `getMeProviders()` fetcher (from `GET /me/providers`). Always wrap in an arrow function to avoid TanStack Query passing its context object as the `config` arg:

```ts
const { data: { providers: availableProviders = [] } = {}, isError: providersError } = useQuery({
  queryKey: ['me', 'providers'],
  queryFn: () => getMeProviders(),   // NOT queryFn: getMeProviders — that passes the wrong arg
})
```

### Section 1 — Connected accounts

Lists every account in `accounts[]`. `PROVIDER_DISPLAY` maps known `providerId` values to label + icon. Unknown providers fall back to their raw `providerId` string and `IconKey`. If `accountsError`, shows a red `Alert` instead and hides the password section (state unknown).

### Section 2 — Link another account

Shown only when `!providersError && unlinkableProviders.length > 0`.

```ts
const linkedProviderIds = new Set(accounts.map(a => a.providerId))
const unlinkableProviders = availableProviders.filter(p => !linkedProviderIds.has(p))
```

`availableProviders` comes from `GET /me/providers` — all configured social providers regardless of registration mode. `unlinkableProviders` is the subset not yet linked by this user.

Each row has a "Connect" button that calls `handleLink`:

```ts
async function handleLink(provider: string) {
  setLinkingProvider(provider)
  try {
    const { error } = await authClient.linkSocial({
      provider: provider as 'google' | 'facebook' | 'apple',
      callbackURL: window.location.origin + '/me/sign-in',
    })
    if (error) throw error   // check return value — Better Auth may return error without throwing
  } catch {
    notify({ status: 'danger', message: 'Could not link this account. Please try again.' })
  } finally {
    setLinkingProvider(null)
  }
}
```

`linkSocial` triggers a full browser redirect on success (same behaviour as `signIn.social`). `callbackURL` must be absolute — `window.location.origin + '/me/sign-in'` — so Better Auth redirects to the frontend, not the API server. After returning, TanStack Query re-fetches the accounts query on mount (staleTime: 0 default).

### Section 3 — Password

Derived from `hasPassword = accounts.some(a => a.providerId === 'credential')`:

- `hasPassword === true` → blue `Alert` "Your account has a password set." + `<Anchor href="/me/security">` to change it
- `hasPassword === false` → set-password form (newPassword + confirmPassword)

The set-password mutation invalidates `['me', 'accounts']` on success so the `hasPassword` check re-evaluates immediately without a page reload.

Hidden entirely when `accountsLoading || accountsError`.

## Tests

### `routes/me-page.test.tsx`

Tests for `MeAccount` and `MeSecurity`. Wrapper: `MantineProvider` + `<Notifications />` + `QueryClientProvider`. **No `MantineEmotionProvider`** — these components don't use `createStyles`.

### `routes/me-sign-in.test.tsx`

**Wrapper requires `MantineEmotionProvider`** — `MeSignIn` uses `createStyles` for `flex: 1`:

```tsx
<MantineProvider>
  <MantineEmotionProvider>
    <Notifications />
    <QueryClientProvider client={queryClient}>
      <MeSignIn />
    </QueryClientProvider>
  </MantineEmotionProvider>
</MantineProvider>
```

**Two mocks required:**

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

**`getMeProviders` via MSW** — default handler returns `{ providers: [] }`. Override per test for linking section tests.

**`postMeSetPassword` via MSW** — default handler returns 204.

**`afterEach`** — `vi.clearAllMocks()` resets call counts but NOT mock return values. The top-level `beforeEach` re-sets `mockListAccounts` to `{ data: [], error: null }` so each test starts clean.

**Key assertions:**

- Wait for both queries to settle before asserting absence: `await screen.findByText('Email & Password')` proves accounts resolved; wrap the absence assertion in `waitFor` to wait for providers too.
- Use `findAllByRole` (async) not `getAllByRole` (sync) for connect buttons — providers query resolves after accounts.
- Error state: mock `listAccounts` to return `{ data: null, error: { message: '...' } }` to test the `accountsError` branch.

## Handler naming for `me-sign-in` endpoints

| Endpoint | Handler | Default response |
|---|---|---|
| `GET /me/providers` | `getMeProvidersHandler` | `{ providers: [] }` |
| `POST /me/set-password` | `postMeSetPasswordHandler` | `204` |
