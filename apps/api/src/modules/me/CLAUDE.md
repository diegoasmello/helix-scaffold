# me module — backend

Self-service profile management. Operates on the current authenticated user only — no `requirePermission` guard on any route. All endpoints require a valid session but no specific RBAC grant.

## Data model

No dedicated table. Reads and writes the `user` table from better-auth (`src/db/schema/authentication.ts`). This is the same table used by the users module, and `GET`/`PATCH /me` answer with the same `userWithRoleSchema` (`role: { id, name } | null`) — `getMe` reuses `getUserWithRole(database, id)` from `users-service.ts`.

Social provider information lives in the `account` table (also better-auth managed). Each row has `providerId` (`"credential"` for email/password, `"google"` / `"facebook"` / `"apple"` for OAuth) and `password` (only non-null for credential accounts). The me module reads it directly only for the password hash `confirmPassword()` checks; everything else goes through `auth.api.*`.

## Schema (`me-schema.ts`)

- `updateMeSchema` — `{ name: z.string().min(1).optional() }`. Name only — partial update.
- `updateMeEmailSchema` — `{ newEmail: z.email(), currentPassword?: string }`. `currentPassword` is required (by the service, not the schema) when the account has a password.
- `updateMePasswordSchema` — `{ currentPassword: z.string().min(1), newPassword: z.string().min(8) }`. `confirmPassword` is a frontend-only concern — not validated here.
- `setPasswordSchema` — `{ newPassword: z.string().min(8) }`. Used by the set-password endpoint. No `currentPassword` — this endpoint is for users who do not yet have a credential account.

## Service (`me-service.ts`)

`createMeService(database, auth, emailProvider)` — takes `database`, `auth` (better-auth instance), and `emailProvider` (for email notifications).

Returns `{ getMe, updateMe, changeEmail, updatePassword, setPassword }`.

**Re-authentication and attempt limit.** A stolen session must not be enough to take the account over, and better-auth's own rate limit skips `auth.api.*` calls. So the service keeps one `createAttemptLimiter()` (`src/lib/attempt-limiter.ts`: 5 wrong current passwords per user per 15 minutes, in memory, per process) shared by `changeEmail` and `updatePassword`: once reached, both answer **429** `too_many_attempts` — the right password included — until the window ends; a right password clears the count. `confirmPassword(userId, password)` reads the credential account's hash (`account` table, `providerId: 'credential'`) and checks it with `(await auth.$context).password.verify()`; a social-only account (no hash) is not asked.

**`getMe(userId)`** — selects from the `user` table by `id`. Returns the raw user row.

**`updateMe(userId, data)`** — only runs `db.update(...).set(data)` if `data.name` is defined. Re-fetches via `getMe(userId)` and returns the fresh row.

**`changeEmail(userId, data, headers, currentEmail)`** — first `confirmPassword()` (**400** `current_password_required` / `invalid_password`, before anything else — the "already in use" check too), then **400** `email_taken` when another account has the address, then delegates to `auth.api.changeEmail` with `callbackURL: env.CLIENT_URL + '/me/account'`. better-auth creates a verification token, stores it in the `verification` table, and calls `sendVerificationEmail` (which sends the email to the new address) through `runInBackgroundOrAwait`. Without a background-task handler configured it awaits the send, but **catches and only logs any error** ("Failed to run background task") — so a delivery failure still returns 200 and the user never gets the link. See `src/lib/email/CLAUDE.md` → _better-auth and the background task limitation_ for the workaround. Returns void — the email is not changed immediately; it changes only after the user clicks the verification link. On success it also sends the **current** address a best-effort notice naming the new one ("Your email address is being changed"), so the owner can react before the link is used.

**`updatePassword(userId, data, headers, userEmail)`** — checks the attempt limit, then delegates to `auth.api.changePassword` with `revokeOtherSessions: true` and `returnHeaders: true`. better-auth deletes **every** session of the account (a stolen one included, and the current one too) and opens a new session for this device; the function returns its `Set-Cookie` values (`headers.getSetCookie()`) for the route to send. A wrong current password (better-auth's `INVALID_PASSWORD`) counts as a failed attempt and becomes **400** `invalid_password`; other better-auth errors propagate as `APIError`. After a successful change, sends a best-effort notification email to `userEmail` (failures are silently swallowed via `.catch(() => {})`). A password reset (`/api/auth/reset-password`) signs out every session too — `emailAndPassword.revokeSessionsOnPasswordReset` in `src/auth.ts`.

**`setPassword(data, headers, userEmail)`** — delegates to `auth.api.setPassword`. Intended for users who signed up via OAuth and have no credential account yet. Throws `APIError` if the user already has a credential account (i.e. already has a password) — the route returns 400 in that case. After success, sends a best-effort notification email, same pattern as `updatePassword`.

## Routes (`me-routes.ts`)

Receives `{ database, auth, emailProvider }` — no `requirePermission` parameter.

| Method  | Path                | Notes                                                                                    |
| ------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `GET`   | `/me`               | Returns the current user with their role (`userWithRoleSchema`) — the web shows the role's name in the header |
| `PATCH` | `/me`               | Updates name only; returns updated user                                                  |
| `PATCH` | `/me/email`         | Initiates email change (sends verification email); returns `{ message }`                 |
| `PATCH` | `/me/password`      | Changes password (requires current password); returns 204                                |
| `POST`  | `/me/set-password`  | Sets a password for a social-only account; returns 204 or 400 if already has credential |
| `GET`   | `/me/providers`     | Social providers the user can link (for the link-account UI); `{ providers }`, `[]` in closed mode |

**`GET /me`** — `const userId = request.sessionUser.id` then `service.getMe(userId)`.

**`PATCH /me`** — name only. No email field, no 409. Audit: `request.audit('edit', 'me', userId, request.body)`.

**`PATCH /me/email`** — calls `service.changeEmail(userId, body, headers, sessionUser.email)`. `DomainError`s pass through (400 `current_password_required` / `invalid_password` / `email_taken`, 429 `too_many_attempts`); an `APIError` from better-auth → 400 `{ message, code: 'email_change_rejected' }`. Other errors → 500 `{ message: 'Failed to send verification email' }` — in practice unreachable for delivery failures, which better-auth swallows (see above). On success → 200 `{ message: 'Check your new email address to confirm the change' }`. Audit: `{ emailChangeRequested: true }` — never logs the actual email address.

**`PATCH /me/password`** — 400 `invalid_password` for a wrong current password, 429 `too_many_attempts` when locked out (`DomainError`s); any other `APIError` → 400 `{ message, code: 'password_change_rejected' }`. Returns 204 on success, with the new session's `Set-Cookie` (`reply.header('set-cookie', …)`): the cookie the request carried no longer works, every other device is signed out. Audit: `{ passwordChanged: true }` — never logs actual password values.

**`POST /me/set-password`** — calls `service.setPassword(body, headers, sessionUser.email)`. Catches `APIError` → 400 `{ message }` (better-auth rejects if the user already has a credential account). Returns 204 on success. Audit: `{ passwordSet: true }`.

**`GET /me/providers`** — calls `getUsableSocialProviders(config)` from `src/lib/social-providers.ts` (`config` comes in the route options): the providers enabled in `config.auth.socialProviders` in open mode, `[]` in closed mode. Same list as `GET /registration/status` — closed mode is email/password only, and a provider linked there could never be used to sign in. With `[]` the frontend hides the "link another account" section; already linked accounts are still listed.

## Shared utility: `src/lib/social-providers.ts`

`getUsableSocialProviders()` returns the enabled provider names (`"google"`, `"facebook"`, `"apple"`) in open mode and `[]` in closed mode. Used by:

- `registration-routes.ts` — for `GET /registration/status`
- `me-routes.ts` — for `GET /me/providers`

It reads `config.auth.socialProviders`, so a new provider needs no change here — see `apps/api/CLAUDE.md` → _Shared social provider utility_ for the files that do change.

## Permissions config

None. Every `me` endpoint requires only a session, and the frontend `/me` routes have no permission guard: managing your own profile (name, email, password, sign-in methods, preferences) is a right of every account, so no role can take it away. There is deliberately no `me` entry in `RESOURCE_DEFINITIONS` — it was removed, and migration `0008_drop_me_permissions` deleted the old `me:*` grants. Do not add `requirePermission` to these routes.

## Tests (`me-routes.test.ts`)

**No `beforeEach` cleanup** — the test file operates on the single test user (`test@test.com`, role `__test_admin__`) created by `createTestSession`. The test DB is not truncated between tests.

**`PATCH /me/email` test** — sends a valid `newEmail` with the current password, asserts 200 with a message string. Cleans up the verification token from the `verification` table after the test to avoid state leakage.

**Password tests** — `PATCH /me/password` restores the original password after the test. Every change revokes the sessions, so the file's `changePassword()` helper moves `authCookie` to the cookie the response sets; a test asserts that another session and the previous cookie get 401 while the new one gets 200. `src/auth.test.ts` asserts the same for a password reset. `POST /me/set-password` returns 400 for the test admin (who has a credential account) and 400 for a short password. The 204 success case requires a social-only user (no credential account) and is not covered here — it relies on E2E tests with a real OAuth flow.

**`describe('Re-authentication')`** — each test signs up its own user (so a lockout stays theirs): email change without / with a wrong password (400, no verification token), the notice to the current address (spies `console.log`, the test email provider), no password asked of a social-only account (credential row deleted), lockout after 5 wrong passwords across both routes (429 even with the right one), a right password clears the count. The limiter's window is unit-tested in `src/lib/attempt-limiter.test.ts`.

**`GET /me/providers`** — asserts 200 and that `providers` is an array. Does not assert `[]` because `src/config/test-overrides.ts` does not override `auth.socialProviders`, so the result follows whatever `app.config.ts` enables.

**No permission enforcement tests** — there are no `requirePermission` guards on these routes, so no 403 cases exist.
