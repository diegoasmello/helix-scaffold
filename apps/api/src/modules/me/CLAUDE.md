# me module — backend

Self-service profile management. Operates on the current authenticated user only — no `requirePermission` guard on any route. All three endpoints require a valid session but no specific RBAC grant.

## Data model

No dedicated table. Reads and writes the `user` table from better-auth (`src/db/schema/authentication.ts`). This is the same table used by the users module, but `me-routes.ts` uses `userSchema` (without `.meta()`, no role embed) — **not** `userWithRoleSchema`.

## Schema (`me-schema.ts`)

- `updateMeSchema` — `{ name: z.string().min(1).optional(), email: z.string().email().optional() }`. Both fields optional — partial update.
- `updateMePasswordSchema` — `{ currentPassword: z.string().min(1), newPassword: z.string().min(8) }`. `confirmPassword` is a frontend-only concern — not validated here.

## Service (`me-service.ts`)

`createMeService(database, auth)` — takes both `database` and `auth` (better-auth instance) because password change delegates to `auth.api.changePassword`.

Returns `{ getMe, updateMe, updatePassword }`.

**`getMe(userId)`** — selects from the `user` table by `id`. Returns the raw user row.

**`updateMe(userId, data)`** — guards against no-op: only runs `db.update(...).set(data)` if at least one of `data.name` or `data.email` is defined. After the update, re-fetches via `getMe(userId)` and returns the fresh row. Does not return the drizzle update result directly.

**`updatePassword(request, data)`** — delegates to `auth.api.changePassword` with the full request headers forwarded via `fromNodeHeaders(request.headers)` and `revokeOtherSessions: false`. Returns the better-auth response. Throws `APIError` from better-auth if the current password is incorrect.

## Routes (`me-routes.ts`)

Receives `{ database, auth }` — no `requirePermission` parameter.

| Method  | Path           | Notes                                                           |
| ------- | -------------- | --------------------------------------------------------------- |
| `GET`   | `/me`          | Returns the current user; uses `userSchema` (no role embed)     |
| `PATCH` | `/me`          | Updates name/email; returns updated user                        |
| `PATCH` | `/me/password` | Changes password; returns 204                                   |

**`GET /me`** — `const userId = request.sessionUser.id` then `service.getMe(userId)`.

**`PATCH /me`** — catches PostgreSQL unique violation (code `23505`) for duplicate email → 409 `{ message: 'Email already in use' }`. The PG error may be wrapped by Drizzle, so the catch checks `e?.cause?.code === '23505'`. Audit: `request.audit('edit', 'me', userId, request.body)`.

**`PATCH /me/password`** — catches `APIError` from better-auth → 400 `{ message: 'Current password is incorrect' }`. Returns 204 on success. Audit: `request.audit('edit', 'me', userId, { passwordChanged: true })` — never logs actual password values.

## Permissions config

None. The `me` resource is not in `RESOURCE_DEFINITIONS` — it has no RBAC entries. All three endpoints are authenticated-only.

## Tests (`me-routes.test.ts`)

**No `beforeEach` cleanup** — the test file operates on the single `__test_admin__` user created by `createTestSession`. The test DB is not truncated between tests.

**Mutation tests restore state** — after each test that mutates the user (name, email), the test restores the original values using another `PATCH /me` call so subsequent tests start from a known state.

**409 test** — seeds a second user with `testDb.insert(user).values({ id: uuidv7(), ... })`, then attempts to update the test user's email to match. Cleans up the seeded user manually after the assertion.

**Password test** — calls `PATCH /me/password` with valid credentials, then verifies the password actually changed by signing in with the new password, then restores the original password. The test user's password is available as a constant from the test helpers.

**No permission enforcement tests** — there are no `requirePermission` guards on these routes, so no 403 cases exist.
