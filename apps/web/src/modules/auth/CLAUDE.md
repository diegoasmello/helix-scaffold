# auth module — frontend

Provides the authentication layer consumed by the entire application: session state, permission checking, route guards, and the public screens (bootstrap, login, sign-up). Not a CRUD module — has no DataTable, no mutations via TanStack Query, and no `@helix/api-client` hooks for data writes.

## File structure

```
src/modules/auth/
├── types.ts                        ← User and AuthState types
├── use-auth.ts                     ← primary auth hook
├── use-registration-open.ts        ← useRegistrationOpen() + registrationStatusQueryOptions() (GET /registration/status, cached for the session)
├── page-access.ts                  ← PageAccess, checkPageAccess, guardPage (route guards), createPermissionChecker
├── page-access.test.ts
├── components/
│   ├── auth-guard.tsx              ← authenticated route wrapper
│   ├── has-permission.tsx          ← conditional render by permission
│   └── social-login-buttons.tsx    ← OAuth provider buttons (Google, Facebook, Apple)
└── routes/
    ├── index.ts                    ← bootstrapRoute, loginRoute, signUpRoute, forgotPasswordRoute, resetPasswordRoute
    ├── bootstrap.tsx               ← first-run admin setup screen
    ├── bootstrap.test.tsx
    ├── login.tsx                   ← sign-in screen
    ├── login.test.tsx              ← also covers SocialLoginButtons
    ├── sign-up.tsx                 ← self-registration screen
    ├── sign-up.test.tsx            ← also covers SocialLoginButtons
    ├── forgot-password.tsx         ← request password reset by email
    ├── forgot-password.test.tsx
    ├── reset-password.tsx          ← set new password via token from email link
    └── reset-password.test.tsx
```

`use-auth.ts`, `AuthGuard` and `HasPermission` have no test files of their own. `HasPermission` and `useAuth` are covered by every list-screen test that checks permission-gated buttons, and by `src/app.test.tsx`.

No `validation.ts`, no `hooks.ts`, no shared form component — each screen owns its own inline `useForm` and validators.

## `authClient` (`src/lib/authentication.ts`)

`authClient` is a `better-auth` React client created with ``createAuthClient({ baseURL: `${API_URL}/auth` })`` (`src/lib/api-url.ts`). It is the **only** place in the codebase that talks to better-auth directly. Everything else goes through `useAuth()`.

Relevant methods used across the module:

| Method | Where used |
| --- | --- |
| `authClient.useSession()` | `useAuth` — reactive session subscription |
| `authClient.getSession()` | `authenticatedRoute.beforeLoad` in `routes.ts` — one-shot async check |
| `authClient.signIn.email({ email, password })` | `Login` screen |
| `authClient.signUp.email({ name, email, password })` | `SignUp` screen |
| `authClient.signIn.social({ provider, callbackURL, errorCallbackURL })` | `SocialLoginButtons` component |
| `authClient.requestPasswordReset({ email, redirectTo })` | `ForgotPassword` screen |
| `authClient.resetPassword({ newPassword, token })` | `ResetPassword` screen |

**`signIn.social` behaviour:** triggers a full browser redirect to the OAuth provider. The `await` resolves only if the call fails (e.g. network error) — in the happy path the page navigates away before the Promise settles. Always wrap it in `try/catch` to surface errors to the user; the `finally` block handles clearing the loading state.

## `useAuth` (`use-auth.ts`)

The single source of truth for session + permissions state in React components. Returns `AuthState`:

```ts
type AuthState = {
  user: User | null            // null when no session
  grants: Grants               // { [resource]: action[] }
  isPending: boolean           // true while session OR permissions are loading
  isAuthenticated: boolean     // true when user is not null
  hasPermission: (resource: PermissionResource, action: PermissionAction) => boolean
}
```

`PermissionResource` (`@helix/api-client/types`) is the enum of the API's catalog (`RESOURCE_DEFINITIONS`), so `hasPermission('user', 'view')`, `<HasPermission resource="user">` and a `PageAccess` with a typo do not compile. A resource added in the API reaches it after `pnpm spec:sync`. The action is not checked per resource here — the API's `requirePermission()` is.

**Three async pieces composed together:**

1. `authClient.useSession()` — returns the better-auth session. The `user` object is shaped from `session.user`; `roleId` is cast from `session.user` as it is not in better-auth's default type.

2. `useQuery(getMeSuspenseQueryKey(), getMeSuspense)` — the profile (`GET /me`, same cache entry as `/me/account`), enabled once there is a session, `staleTime: Infinity`. It gives `user.name` (fresh after the user renames themselves) and `user.roleName` (the header's user menu shows it under the name; `null` until it loads or without a role).

3. `useQuery(getMePermissionsQueryKey(), getMePermissions)` — fetches `GET /me/permissions`. Only enabled when `!!user` (skipped when unauthenticated). `staleTime: 30_000` (30 s cache).

`isPending` is `true` when the session is loading **or** when the user is known but permissions have not resolved yet. This prevents a flash where `hasPermission` returns `false` before grants arrive.

`hasPermission(resource, action)` checks `grants[resource]?.includes(action) ?? false`.

## Two separate permission-check mechanisms

There are two places where permissions are checked, serving different purposes:

| Mechanism | Where | Purpose |
| --- | --- | --- |
| `authenticatedRoute.beforeLoad` in `routes.ts` | Route entry | Blocks navigation before render; uses `authClient.getSession()` + `ensureQueryData(getMePermissionsQueryOptions())` synchronously |
| `useAuth()` / `hasPermission()` in components | Inside render | Drives `<HasPermission>` and sidebar filtering; reads from React Query cache |

The `beforeLoad` injects `hasPermission` (plus `hasSubscriptionAccess` and `subscriptionEnabled`) into the router context. Child routes don't read it by hand: their `beforeLoad` is `guardPage(<PageAccess>)` from `page-access.ts`, which redirects (`/`, `/upgrade` or `/403`) before any component renders. Both mechanisms build `hasPermission` with `createPermissionChecker(grants)`, so they cannot disagree.

The component-level `useAuth()` reads the **same** permissions from the React Query cache (populated by `beforeLoad`) — no extra network request is made.

## Page access (`page-access.ts`)

- `PageAccess` — `{ permission?, feature?, requiresSubscriptions? }`, declared once per page in each module's `routes/access.ts`.
- `checkPageAccess(access, checkers)` — the decision: `{ allowed: true }` or the redirect (`/` when subscriptions are off, `/upgrade` without the plan feature, `/403` without the permission — in that order).
- `guardPage(access)` — the `beforeLoad` that throws that redirect. It carries `.access`, so `src/routes.test.ts` can check each sidebar item against its route.
- `createPermissionChecker(grants)` — `hasPermission` over `GET /me/permissions` grants.

`page-access.test.ts` covers the decision matrix, the thrown redirects and the checker. The sidebar (`src/config/sidebar.ts`) uses `checkPageAccess` too — see `apps/web/CLAUDE.md` → _Route-level guards_.

## `AuthGuard` (`components/auth-guard.tsx`)

Component set on `authenticatedRoute` in `routes.ts`. Renders `<Outlet />` when authenticated, a full-screen `<Loader />` while pending, and `null` while navigating away. Redirects to `/login` via `useEffect` when `!isPending && !isAuthenticated`.

The redirect in `useEffect` is a fallback for when the session expires mid-session. The primary guard is `authenticatedRoute.beforeLoad`, which runs before render.

## `HasPermission` (`components/has-permission.tsx`)

Renders `children` when `hasPermission(resource, action)` is true; renders `null` otherwise. Calls `useAuth()` internally. Usage:

```tsx
import { HasPermission } from '../../auth/components/has-permission'

<HasPermission resource="users" action="create">
  <Button>Create</Button>
</HasPermission>
```

## Routes (`routes/index.ts`)

All five routes have `rootRoute` as parent (not `authenticatedRoute`) — they are public and render outside the app layout.

| Constant | Path | Loader data |
| --- | --- | --- |
| `bootstrapRoute` | `/bootstrap` | none — redirects to `/login` if already bootstrapped |
| `loginRoute` | `/login` | `{ registrationOpen: boolean, providers: string[] }`; `validateSearch` `{ error? }` — a refused social sign-in |
| `signUpRoute` | `/sign-up` | `{ providers: string[] }` |
| `forgotPasswordRoute` | `/forgot-password` | none — redirects to `/bootstrap` if not bootstrapped |
| `resetPasswordRoute` | `/reset-password` | none — reads `{ token?, error? }` from `validateSearch` |

`bootstrapRoute` and `loginRoute` form a **mutual redirect guard**: each loader calls `getBootstrapStatus()` and redirects to the other if the system state doesn't match. This prevents accessing the bootstrap screen on a live system and prevents accessing login on a blank system.

**Registration mode and social providers:**

Both `loginRoute.loader` and `signUpRoute.loader` parallelise `getBootstrapStatus()` and `getRegistrationStatus()` via `Promise.all`:

```ts
// loginRoute.loader
const [{ bootstrapped }, { open, providers }] = await Promise.all([
  getBootstrapStatus(),
  getRegistrationStatus(),
])
if (!bootstrapped) throw redirect({ to: '/bootstrap' })
return { registrationOpen: open, providers }

// signUpRoute.loader
const [{ bootstrapped }, { open, providers }] = await Promise.all([
  getBootstrapStatus(),
  getRegistrationStatus(),
])
if (!bootstrapped) throw redirect({ to: '/bootstrap' })
if (!open) throw redirect({ to: '/login' })
return { providers }
```

`signUpRoute.loader` redirects to `/login` if registration is closed — so the `SignUp` component is only reachable in open mode. The backend also enforces this via a 403 on `POST /api/auth/sign-up/email` and `disableSignUp` on each social provider.

The `Login` component reads `{ registrationOpen, providers }` via `loginRoute.useLoaderData()`:
- Shows "Create one" link only when `registrationOpen` is true.
- Shows `<SocialLoginButtons>` only when `registrationOpen && providers.length > 0`.

The `SignUp` component reads `{ providers }` via `signUpRoute.useLoaderData()`:
- Shows `<SocialLoginButtons>` whenever `providers.length > 0` (no `registrationOpen` check — the page is only reachable when open).

## Password reset flow

The reset flow is a **two-hop redirect** handled by Better Auth:

1. `ForgotPassword` calls `authClient.requestPasswordReset({ email, redirectTo: window.location.origin + '/reset-password' })`
2. Better Auth sends an email with a link that points to the **backend**: `${API_BASE}/reset-password/${token}?callbackURL=${encodedRedirectTo}`
3. The user clicks the link → backend validates the token and redirects to `${redirectTo}?token=${token}` (the frontend)
4. `ResetPassword` reads `token` from `validateSearch` and calls `authClient.resetPassword({ newPassword, token })`

**Key details:**

- The `url` in `sendResetPassword` (backend) is the API callback URL, not the frontend URL — this is by design. Never send it directly to the user as the "reset link"; Better Auth's email already embeds it.
- `validateSearch` on `resetPasswordRoute` declares `{ token?: string, error?: string }`. Better Auth redirects with `?error=INVALID_TOKEN` when a token is expired/invalid — the component renders a differentiated message for this case.
- `resetPasswordRoute` is accessible regardless of the registration mode (password reset works in both open and closed modes).
- Error messages on the reset form are always generic — never reflect `error.message` from the API verbatim (avoids leaking internal Better Auth error codes).

## `SocialLoginButtons` (`components/social-login-buttons.tsx`)

Renders OAuth provider buttons driven by a `providers: string[]` prop. Only renders buttons for providers listed in the internal `PROVIDER_CONFIG` map — unknown provider strings from the backend are silently ignored (forward-compatibility).

```tsx
<SocialLoginButtons providers={providers} />
```

**`PROVIDER_CONFIG`** — the supported providers and their labels/icons:

| Key | Label | Icon |
| --- | --- | --- |
| `"google"` | Continue with Google | `IconBrandGoogle` |
| `"facebook"` | Continue with Facebook | `IconBrandFacebook` |
| `"apple"` | Continue with Apple | `IconBrandApple` |

**Behaviour:**
- Returns `null` when `providers` has no known entries — renders nothing, no DOM output.
- One loading state per button; other buttons are `disabled` while one is in flight.
- `callbackURL: window.location.origin + '/'` — absolute URL so Better Auth redirects to the frontend, not the API server, after the OAuth flow completes. **Never use a relative path like `'/'` here.**
- `errorCallbackURL: window.location.origin + '/login'` — a refused sign-in lands on `/login?error=<code>` instead of the API's bare error page. `Login` reads it with `loginRoute.useSearch()` and shows `social.errors.accountNotLinked` for `account_not_linked` (the email already has an account and linking is never implicit — the user signs in with the password and connects the provider on `/me/security`), `social.errors.providerError` for anything else. Tested in `login.test.tsx` → _refused social sign-in_ (the route mock carries `useSearch`).
- Errors from `signIn.social` (network failures, provider errors) are caught and shown as a red error message below the buttons. The loading spinner is always cleared via `finally`.

**Adding a new provider:**
1. Add it to `PROVIDER_CONFIG` in `social-login-buttons.tsx`.
2. Add it to `AppConfig` and `appConfigSchema` in `apps/api/src/config/define-config.ts`, and to the credential map in `apps/api/src/config/index.ts`.
3. Add its credentials to `apps/api/src/env.ts` and `.env.example`.
4. Add its entry to `socialProviders` in `apps/api/src/auth.ts`.
5. Enable it in `apps/api/src/app.config.ts`.

**Placement on screens:**
- **Login** — below the submit button, separated by `<Divider label="or" labelPosition="center" />`. Guarded by `registrationOpen && providers.length > 0`.
- **Sign-up** — below the submit button, same Divider pattern. Guarded by `providers.length > 0` only (the route itself is the open-mode guard).

## Screen conventions

All public auth screens share the same pattern:
- Full-screen `<Center h="100vh">` with a `<Paper>` card.
- Native `<form onSubmit={form.onSubmit(handleSubmit)}>` — **not** the `<Form>` component from `@helix/ui` (no `useBlocker` needed on public screens).
- Server errors shown via `useState<string | null>` inline below the last field — no `notify()`.
- Navigation via `route.useNavigate()` on success.
- Auth calls go directly to `authClient` or `postBootstrap` — not via `useMutation`.

Notable per-screen exceptions:
- `SignUp` — cross-field validator (`confirmPassword` checks against `values.password`).
- `ForgotPassword` — no navigation on success; instead sets `submitted` state and renders a success message inside the same `<Paper>` card (never reveals whether the email exists).
- `ResetPassword` — `handleSubmit` is declared as a `const` arrow function **after** the `if (!token)` early return so TypeScript narrows `token` to `string` in its body. Do not convert it to a `function` declaration (which would be hoisted and lose the narrowing).

## How auth screens are mocked in integration tests

Auth screen tests mock `loginRoute` and `signUpRoute` via `vi.mock('.')` (the local route index). The mock must include `useLoaderData` since both screens now read loader data:

```ts
// login.test.tsx
const { mockUseLoaderData } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn().mockReturnValue({ registrationOpen: false, providers: [] }),
}))

vi.mock('.', () => ({
  loginRoute: {
    useNavigate: () => mockNavigate,
    useLoaderData: mockUseLoaderData,
  },
}))

// sign-up.test.tsx
const { mockUseLoaderData } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn().mockReturnValue({ providers: [] }),
}))

vi.mock('.', () => ({
  signUpRoute: {
    useNavigate: () => mockNavigate,
    useLoaderData: mockUseLoaderData,
  },
}))
```

**`afterEach` reset is required:** `vi.clearAllMocks()` resets call counts but not return values. Without the explicit `mockReturnValue` reset in `afterEach`, subsequent tests receive `undefined` from `useLoaderData()` and crash. Always reset to the safe default after each test.

**Social button tests:** override `mockUseLoaderData` inside the test and include `signIn: { social: mockSignInSocial }` in the `authClient` mock. Since `SocialLoginButtons` returns `null` when `providers: []`, the default mock is safe for all non-social tests — `signIn.social` is never called.

## How auth components are mocked in integration tests

Two mocks are required in every route test file that renders a component behind `useAuth`:

```ts
// 1. Mock the component's own route constant (from the local route index),
//    not @tanstack/react-router — components read hooks from the route object
vi.mock('.', () => ({
  xxxListRoute: {
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 10, sortOrder: 'desc' }),
  },
}))

// 2. Mock authClient.useSession so useAuth returns a real user
//    Without this, useAuth sees no session → permissions query never fires
//    → HasPermission always renders null → action buttons are always hidden
vi.mock('../../../lib/authentication', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: 'test-user',
          name: 'Test',
          email: 'test@example.com',
          image: null,
          roleId: 'test-role',
        },
      },
      isPending: false,
    }),
  },
}))
```

The permissions response is controlled via `getMePermissionsHandler` from `@helix/api-client/mocks` — the default MSW handler returns `{ grants: {} }`, so tests override it in `beforeEach` with the grants their component needs.

## How `app.tsx` uses auth

`App` calls `useAuth()` for the user passed to `<Layout>` and for sidebar filtering: an item with `permission` shows when `hasPermission(...)` is true; an item without one shows to any authenticated user. The full filter also applies the subscription rules — see `src/modules/subscriptions/CLAUDE.md` → _Sidebar_.
