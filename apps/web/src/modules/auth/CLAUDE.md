# auth module — frontend

Provides the authentication layer consumed by the entire application: session state, permission checking, route guards, and the public screens (bootstrap, login, sign-up). Not a CRUD module — has no DataTable, no mutations via TanStack Query, and no `@helix/api-client` hooks for data writes.

## File structure

```
src/modules/auth/
├── types.ts                        ← User and AuthState types
├── use-auth.ts                     ← primary auth hook
└── components/
│   ├── auth-guard.tsx              ← authenticated route wrapper
│   └── has-permission.tsx          ← conditional render by permission
└── routes/
    ├── index.ts                    ← bootstrapRoute, loginRoute, signUpRoute
    ├── bootstrap.tsx               ← first-run admin setup screen
    ├── login.tsx                   ← sign-in screen
    └── sign-up.tsx                 ← self-registration screen
```

No `validation.ts`, no `hooks.ts`, no `components/` form — each screen owns its own inline `useForm` and validators.

## `authClient` (`src/lib/authentication.ts`)

`authClient` is a `better-auth` React client created with `createAuthClient({ baseURL: env.VITE_API_URL })`. It is the **only** place in the codebase that talks to better-auth directly. Everything else goes through `useAuth()`.

Relevant methods used across the module:

| Method | Where used |
| --- | --- |
| `authClient.useSession()` | `useAuth` — reactive session subscription |
| `authClient.getSession()` | `authenticatedRoute.beforeLoad` in `routes.ts` — one-shot async check |
| `authClient.signIn.email({ email, password })` | `Login` screen |
| `authClient.signUp.email({ name, email, password })` | `SignUp` screen |

## `useAuth` (`use-auth.ts`)

The single source of truth for session + permissions state in React components. Returns `AuthState`:

```ts
type AuthState = {
  user: User | null            // null when no session
  grants: Grants               // { [resource]: action[] }
  isPending: boolean           // true while session OR permissions are loading
  isAuthenticated: boolean     // true when user is not null
  hasPermission: (resource: string, action: PermissionAction) => boolean
}
```

**Two async pieces composed together:**

1. `authClient.useSession()` — returns the better-auth session. The `user` object is shaped from `session.user`; `roleId` is cast from `session.user` as it is not in better-auth's default type.

2. `useQuery(getMePermissionsQueryKey(), getMePermissions)` — fetches `GET /me/permissions`. Only enabled when `!!user` (skipped when unauthenticated). `staleTime: 30_000` (30 s cache).

`isPending` is `true` when the session is loading **or** when the user is known but permissions have not resolved yet. This prevents a flash where `hasPermission` returns `false` before grants arrive.

`hasPermission(resource, action)` checks `grants[resource]?.includes(action) ?? false`.

## Two separate permission-check mechanisms

There are two places where permissions are checked, serving different purposes:

| Mechanism | Where | Purpose |
| --- | --- | --- |
| `authenticatedRoute.beforeLoad` in `routes.ts` | Route entry | Blocks navigation before render; uses `authClient.getSession()` + `ensureQueryData(getMePermissionsQueryOptions())` synchronously |
| `useAuth()` / `hasPermission()` in components | Inside render | Drives `<HasPermission>` and sidebar filtering; reads from React Query cache |

The `beforeLoad` injects `hasPermission` into the router context so child route `beforeLoad` hooks can call `context.hasPermission(resource, action)` and `throw redirect({ to: '/403' })` before any component renders.

The component-level `useAuth()` reads the **same** permissions from the React Query cache (populated by `beforeLoad`) — no extra network request is made.

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

All three routes have `rootRoute` as parent (not `authenticatedRoute`) — they are public and render outside the app layout.

| Constant | Path | Notes |
| --- | --- | --- |
| `bootstrapRoute` | `/bootstrap` | Redirects to `/login` if already bootstrapped |
| `loginRoute` | `/login` | Redirects to `/bootstrap` if not bootstrapped; returns `{ registrationOpen }` |
| `signUpRoute` | `/sign-up` | Redirects to `/bootstrap` if not bootstrapped; redirects to `/login` if registration is closed |

`bootstrapRoute` and `loginRoute` form a **mutual redirect guard**: each loader calls `getBootstrapStatus()` and redirects to the other if the system state doesn't match. This prevents accessing the bootstrap screen on a live system and prevents accessing login on a blank system.

**Registration mode awareness:**

`loginRoute.loader` parallelises two independent calls via `Promise.all` and returns `{ registrationOpen }`:

```ts
const [{ bootstrapped }, { open }] = await Promise.all([
  getBootstrapStatus(),
  getRegistrationStatus(),
])
if (!bootstrapped) throw redirect({ to: '/bootstrap' })
return { registrationOpen: open }
```

`signUpRoute.loader` uses `getRegistrationStatus()` as an access guard — redirects to `/login` if registration is closed. This prevents direct URL access to `/sign-up` in closed-mode deployments (the backend also enforces this via a 403 on the sign-up endpoint).

The `Login` component reads `registrationOpen` via `loginRoute.useLoaderData()` and conditionally renders a "Create one" link below the submit button when `true`.

## Screen conventions

All three screens (`Bootstrap`, `Login`, `SignUp`) share the same pattern:
- Full-screen `<Center h="100vh">` with a `<Paper>` card.
- Native `<form onSubmit={form.onSubmit(handleSubmit)}>` — **not** the `<Form>` component from `@helix/ui` (no `useBlocker` needed on public screens).
- Server errors shown via `useState<string | null>` inline below the last field — no `notify()`.
- Navigation via `route.useNavigate()` on success.
- Auth calls go directly to `authClient` or `postBootstrap` — not via `useMutation`.

`SignUp` is the only screen with a cross-field validator (`confirmPassword` checks against `values.password`).

## How auth is mocked in integration tests

Two mocks are required in every route test file that renders a component behind `useAuth`:

```ts
// 1. Mock the router hooks (navigation, params, search)
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({ page: 1, pageSize: 10, sortOrder: 'desc' }),
  useParams: () => ({}),
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

`App` calls `useAuth()` to filter the sidebar and pass the current user to `<Layout>`:

```ts
const visibleItems = sidebarItems.filter((item) =>
  item.permission
    ? hasPermission(item.permission.resource, item.permission.action)
    : isAuthenticated   // items without permission (e.g. Profile) show when logged in
)
```
