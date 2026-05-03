# me module — frontend

Single-screen module for profile self-service. No list/create/detail/edit split — one page with two independent forms. No `beforeLoad` permission guard — the route only requires authentication.

## File structure

```
src/modules/me/
├── types.ts
├── validation.ts
└── routes/
    ├── index.ts
    ├── me-pending.tsx
    └── me-page.tsx
```

No `hooks.ts`, no `components/`.

## Types (`types.ts`)

| Alias                | Source (`@helix/api-client/types`)  |
| -------------------- | ----------------------------------- |
| `MeProfile`          | `GetMeQueryResponse`                |
| `UpdateMeInput`      | `PatchMeMutationRequest`            |
| `UpdateMePasswordInput` | `PatchMePasswordMutationRequest` |

Form-specific interfaces (not from the API):

```ts
interface MeFormValues {
  name: string
  email: string
}

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string  // frontend-only — not sent to the API
}
```

## Validation (`validation.ts`)

Two validators, each used by its own form:

**`meFormValidate`**
- `name`: required
- `email`: required, must be a valid email format

**`passwordFormValidate`**
- `currentPassword`: required
- `newPassword`: min 8 characters
- `confirmPassword`: cross-field — `(v, values) => v !== values.newPassword ? 'Passwords do not match' : null`

## Route (`routes/index.ts`)

Single route, not exported as a named constant — assigned to a local `const meRoute` and collected in `meRoutes = [meRoute]`.

| Path  | Permission |
| ----- | ---------- |
| `/me` | none (authenticated only) |

No `beforeLoad` permission check — accessing the profile page requires only a valid session, not any specific RBAC grant. No `loaderDeps`, no `validateSearch`.

Loader: `queryClient.ensureQueryData(getMeSuspenseQueryOptions())`.

## `MePage` (`routes/me-page.tsx`)

Two independent sections, each with its own `<Paper>` and its own native `<form>` (not the `<Form>` component from `@helix/ui`). Using native `<form>` is consistent with other public-scope screens (`login.tsx`, `sign-up.tsx`) — there is no navigation on submit, so `useBlocker` is not needed.

**Two `useForm` instances:**
- `profileForm = useForm<MeFormValues>({ initialValues: { name: item.name, email: item.email }, validate: meFormValidate })`
- `passwordForm = useForm<PasswordFormValues>({ initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' }, validate: passwordFormValidate })`

**Profile mutation** — `useMutation` wrapping `patchMe`:

- `onSuccess`: updates the cache directly with `queryClient.setQueryData(getMeSuspenseQueryKey(), updated)` — no invalidation. Notifies success.
- `onError`: notifies danger.

Both `onSuccess` and `onError` are declared on `useMutation` itself (not on the `mutate()` call) so they fire regardless of mount state.

**Password mutation** — `useMutation` wrapping `patchMePassword`:

- `onSuccess`: calls `passwordForm.reset()` to clear all three fields, notifies success.
- `onError`: notifies danger.

Same pattern — `onSuccess`/`onError` on `useMutation`, not on `mutate()`.

**No navigation on save** — the user stays on the same page.

**No `<HasPermission>` wrappers** — there are no RBAC-gated actions on this page.

## Sidebar

```ts
{ label: 'Profile', icon: IconUser, to: '/me' }
```

No `permission` field — the Profile link is always visible to authenticated users (`app.tsx` shows items without `permission` when `isAuthenticated` is true).

## Tests (`routes/me-page.test.tsx`)

**Wrapper includes `<Notifications />`** (for `notify()` assertions) but **no `<ModalsProvider>`** — the me page has no confirm dialogs.

**`createGetMe200` factory** — the test uses this generated factory (not `createUser` — the `me` endpoint returns a different type, `GetMeQueryResponse`).

**No `getMePermissionsHandler` override** — `MePage` never renders `<HasPermission>`, so the default `{ grants: {} }` from the MSW handler is sufficient.

**Password test helpers** — the generated handlers ship typed response helpers:
- `patchMePasswordHandlerResponse204()` — for success cases
- `patchMePasswordHandlerResponse400({ message })` — for the "current password incorrect" error case

**No router mock needed** — `MePage` calls neither `useNavigate`, `useSearch`, nor `useParams`, so `vi.mock('@tanstack/react-router')` is not required (only the `vi.mock('../../../lib/authentication')` mock is needed for `useAuth`).
