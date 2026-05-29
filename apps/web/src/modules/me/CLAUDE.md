# me module — frontend

Single-screen module for profile self-service. No list/create/detail/edit split — one page (`/me/account`, `/me/security`) with independent forms per concern. No `beforeLoad` permission guard — the route only requires authentication.

## File structure

```
src/modules/me/
├── types.ts
├── validation.ts
├── validation.test.ts
└── routes/
    ├── index.ts
    ├── me-pending.tsx
    ├── me-page.tsx      ← layout with sidebar nav (Account / Security)
    ├── me-account.tsx   ← name form + email change form
    ├── me-security.tsx  ← password change form
    └── me-page.test.tsx
```

No `hooks.ts`, no `components/`.

## Routes (`routes/index.ts`)

| Path | Component | Notes |
|---|---|---|
| `/me` | `MePage` | Layout shell; redirects `/me` → `/me/account` |
| `/me/account` | `MeAccount` | Name update + email change |
| `/me/security` | `MeSecurity` | Password change |

No `beforeLoad` permission check. No `loaderDeps`, no `validateSearch`.

Loader on `meRoute`: `queryClient.ensureQueryData(getMeSuspenseQueryOptions())`.

## Types (`types.ts`)

| Alias | Source (`@helix/api-client/types`) |
|---|---|
| `MeProfile` | `GetMeQueryResponse` |
| `UpdateMeInput` | `PatchMeMutationRequest` — name only |
| `UpdateMeEmailInput` | `PatchMeEmailMutationRequest` — `{ newEmail: string }` |
| `UpdateMePasswordInput` | `PatchMePasswordMutationRequest` |

Form-specific interfaces (not from the API):

```ts
interface MeFormValues { name: string }

interface EmailChangeFormValues { newEmail: string }

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string  // frontend-only — not sent to the API
}
```

## Validation (`validation.ts`)

**`meFormValidate`** — `name`: required.

**`createEmailChangeFormValidate(currentEmail)`** — factory, not a static export. Takes the user's current email so the validator can reject a no-op change:
- `newEmail`: required, valid email format, must differ from `currentEmail`

Usage: `validate: createEmailChangeFormValidate(profile.email)` — call inside the component so `profile.email` is in scope.

**`passwordFormValidate`**
- `currentPassword`: required
- `newPassword`: min 8 characters
- `confirmPassword`: cross-field — must match `newPassword`

## `MeAccount` (`routes/me-account.tsx`)

Three independent forms rendered as separate `<Stack>` sections:

### Name section
- Single `TextInput` for name.
- Mutation: `patchMe({ name })` — `onSuccess` updates the cache via `setQueryData` and notifies success.

### Email change section
- Displays current email in a **disabled** `TextInput` (read-only, not part of any form).
- Email change form with a `newEmail` input — only shown when `emailChangePending === false`.
- Mutation: `patchMeEmail({ newEmail })` — calls `PATCH /me/email` on the backend, which sends a verification link to the new address. The email is **not changed immediately** — it changes only after the user clicks the link.
- `onSuccess`: sets `emailChangePending = true`, stores `pendingEmail`, resets the form. Shows an `Alert` ("Check your inbox") with the pending address.
- `onError`: notifies danger ("Failed to send verification email").
- The alert has a "Use a different email" button (`setEmailChangePending(false)`) so the user can correct a typo without a page reload.

**Important**: `emailChangePending` is component-local state. It resets on unmount (e.g. navigating away and back). This is intentional — the user can always request a new verification link.

### Password section (in `MeSecurity`)
See `me-security.tsx` — separate component, same page layout.

## `MeSecurity` (`routes/me-security.tsx`)

Password change form with three `PasswordInput` fields. Mutation: `patchMePassword`. On success: resets the form and notifies. The backend also sends a best-effort notification email — no frontend involvement needed.

## Tests (`routes/me-page.test.tsx`)

**Wrapper includes `<Notifications />`** but **no `<ModalsProvider>`** — no confirm dialogs.

**`createGetMe200` factory** — use this generated factory (not `createUser`).

**Email change handlers** — generated mocks include:
- `patchMeEmailHandler` — override to test success/failure
- `patchMeEmailHandlerResponse200({ message })` — success helper

**Password test helpers**:
- `patchMePasswordHandlerResponse204()` — success
- `patchMePasswordHandlerResponse400({ message })` — wrong password

**No router mock needed** — `MeAccount` and `MeSecurity` call neither `useNavigate`, `useSearch`, nor `useParams`.
