# me module — backend

Self-service profile management. Operates on the current authenticated user only — no `requirePermission` guard on any route. All endpoints require a valid session but no specific RBAC grant.

## Data model

No dedicated table. Reads and writes the `user` table from better-auth (`src/db/schema/authentication.ts`). This is the same table used by the users module, but `me-routes.ts` uses `userSchema` (without `.meta()`, no role embed) — **not** `userWithRoleSchema`.

## Schema (`me-schema.ts`)

- `updateMeSchema` — `{ name: z.string().min(1).optional() }`. Name only — partial update.
- `updateMeEmailSchema` — `{ newEmail: z.email() }`. Used by the email change endpoint.
- `updateMePasswordSchema` — `{ currentPassword: z.string().min(1), newPassword: z.string().min(8) }`. `confirmPassword` is a frontend-only concern — not validated here.

## Service (`me-service.ts`)

`createMeService(database, auth, emailProvider)` — takes `database`, `auth` (better-auth instance), and `emailProvider` (for email notifications).

Returns `{ getMe, updateMe, changeEmail, updatePassword }`.

**`getMe(userId)`** — selects from the `user` table by `id`. Returns the raw user row.

**`updateMe(userId, data)`** — only runs `db.update(...).set(data)` if `data.name` is defined. Re-fetches via `getMe(userId)` and returns the fresh row.

**`changeEmail(data, headers)`** — delegates to `auth.api.changeEmail` with `callbackURL: env.CLIENT_URL + '/me/account'`. better-auth creates a verification token, stores it in the `verification` table, and fires `sendVerificationEmail` (which sends the email to the new address). Email delivery errors propagate to the caller because `sendVerificationEmail` is called synchronously inside the better-auth handler before the background task runs. Returns void — the email is not changed immediately; it changes only after the user clicks the verification link.

**`updatePassword(data, headers, userEmail)`** — delegates to `auth.api.changePassword` with `revokeOtherSessions: false`. Throws `APIError` from better-auth if the current password is incorrect. After a successful change, sends a best-effort notification email to `userEmail` (failures are silently swallowed via `.catch(() => {})`).

## Routes (`me-routes.ts`)

Receives `{ database, auth, emailProvider }` — no `requirePermission` parameter.

| Method  | Path           | Notes                                                                        |
| ------- | -------------- | ---------------------------------------------------------------------------- |
| `GET`   | `/me`          | Returns the current user; uses `userSchema` (no role embed)                  |
| `PATCH` | `/me`          | Updates name only; returns updated user                                      |
| `PATCH` | `/me/email`    | Initiates email change (sends verification email); returns `{ message }`     |
| `PATCH` | `/me/password` | Changes password; returns 204                                                |

**`GET /me`** — `const userId = request.sessionUser.id` then `service.getMe(userId)`.

**`PATCH /me`** — name only. No email field, no 409. Audit: `request.audit('edit', 'me', userId, request.body)`.

**`PATCH /me/email`** — calls `service.changeEmail(body, headers)`. Catches `APIError` from better-auth → 400 `{ message }`. Other errors → 500 `{ message: 'Failed to send verification email' }`. On success → 200 `{ message: 'Check your new email address to confirm the change' }`. Audit: `{ emailChangeRequested: true }` — never logs the actual email address.

**`PATCH /me/password`** — catches `APIError` from better-auth → 400 `{ message: 'Current password is incorrect' }`. Returns 204 on success. Audit: `{ passwordChanged: true }` — never logs actual password values.

## Permissions config

None. The `me` resource is not in `RESOURCE_DEFINITIONS` — it has no RBAC entries. All four endpoints are authenticated-only.

## Tests (`me-routes.test.ts`)

**No `beforeEach` cleanup** — the test file operates on the single `__test_admin__` user created by `createTestSession`. The test DB is not truncated between tests.

**`PATCH /me/email` test** — sends a valid `newEmail`, asserts 200 with a message string. Cleans up the verification token from the `verification` table after the test to avoid state leakage.

**Password test** — calls `PATCH /me/password` with valid credentials and restores the original password after the test.

**No permission enforcement tests** — there are no `requirePermission` guards on these routes, so no 403 cases exist.
