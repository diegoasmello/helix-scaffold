# bootstrap module — backend

One-shot setup module. Creates the first admin user and role when the system has no users. Has no schema file, no service file, and no persistent state beyond what it writes to the `user`, `roles`, and `role_permissions` tables.

## Purpose

On a fresh deployment the `user` table is empty. `POST /bootstrap` must be called once to create the first admin account. After that the endpoint returns 409 on every subsequent call. The frontend route loaders of `/login`, `/sign-up`, `/forgot-password` and `/bootstrap` call `GET /bootstrap/status` to redirect users to the right screen.

## Registration

Registered at the **root scope** in `app.ts` — outside the `authenticated` scope:

```ts
app.register(bootstrapRoutes, { database, auth })
```

This makes both endpoints **publicly accessible** (no session required). That is intentional: before bootstrap, no session can exist.

## Endpoints

### `GET /bootstrap/status`

Returns `{ bootstrapped: boolean }`. Bootstrapped is `true` when `count(*) > 0` on the `user` table. No auth, no permissions.

### `POST /bootstrap`

Body: `{ name, email, password (min 8) }`.

Flow:
1. Calls `isBootstrapped` — returns `409` if any user exists.
2. Inserts an `'Admin'` role with `description: 'Full system access'`.
3. Inserts one `rolePermission` row for **every entry in `ALL_PERMISSIONS`** (reads from `src/config/permissions.ts`) — the admin role gets all permissions across all resources.
4. Calls `auth.api.signUpEmail({ body: { name, email, password } })`.
5. Updates the newly created user's `roleId` to the admin role.
6. Returns `201 { message: 'System bootstrapped successfully' }`.

Returns `409 { message: 'System already bootstrapped' }` if any user exists at step 1.

**No audit log** — `request.audit` is not available here (outside the authenticated scope).

**Not transactional.** If `signUpEmail` fails after step 3 (e.g. an invalid email that slipped past validation), the `Admin` role stays behind with no user, and every retry fails on the unique `roles.name` until that row is deleted by hand.

There is deliberately no other public way to create an admin — a dev-only `POST /bootstrap/e2e-user` used to exist and was removed; `bootstrap-routes.test.ts` asserts it stays gone. E2E tests sign in with an existing user instead (`apps/web/e2e/auth.setup.ts`).

## Open registration mode

When `registration.mode` is `'open'`, `POST /bootstrap` creates a second role after the admin user is fully set up:

```
1. INSERT Admin role + ALL_PERMISSIONS
2. auth.api.signUpEmail(admin)        ← hook fires, finds no isDefault role → no-op ✓
3. UPDATE user SET roleId = adminRole.id
4. INSERT User role (isDefault = true, no permissions)
```

The User role is always created **after** the admin is assigned the Admin role. This is intentional — the `databaseHooks.user.create.after` in `auth.ts` fires during step 2, before the User role exists, so the admin never accidentally gets the User role.

The User role starts with **no permissions**: what regular users may do is a product decision, granted on `/roles/$id/permissions`. Until then a self-registered user can reach only `/me` (the profile needs just a session) — the frontend's `/` sends them there. The bootstrap test asserts the role has zero permissions.

**Test environment:** `src/config/test-overrides.ts` sets `registration.mode: 'open'` so test helpers can create users via `POST /api/auth/sign-up/email`. The bootstrap test accounts for both roles being created in this mode.

## `ALL_PERMISSIONS` and `src/config/permissions.ts`

`ALL_PERMISSIONS` is a flat array of `{ resource, action }` objects derived from `RESOURCE_DEFINITIONS`. `POST /bootstrap` inserts one `rolePermissions` row per entry for the Admin role. When a new module is added to `RESOURCE_DEFINITIONS`, it is automatically included in the admin role on next bootstrap without any change to this file.

## Tests (`bootstrap-routes.test.ts`)

No `createTestSession` — routes are public. `beforeEach` calls `cleanupAuth()` then manually deletes `rolePermissions` and `roles` (in that order, since `rolePermissions` has a FK to `roles`).

**`POST /bootstrap`** coverage: creates user + role + all permissions (asserts `perms.length === ALL_PERMISSIONS.length`); returns 409 on second call; returns 400 for invalid body. A top-level test asserts `POST /bootstrap/e2e-user` returns 404.

**`GET /bootstrap/status`** coverage: `false` when no users; `true` after a successful bootstrap.

## Frontend counterpart

The bootstrap screen lives in `apps/web/src/modules/auth/routes/bootstrap.tsx` (part of the `auth` module, not a standalone module). Route: `/bootstrap`, parent: `rootRoute` (unauthenticated).

Key behaviours:
- `bootstrapRoute.loader` calls `getBootstrapStatus()` and redirects to `/login` if already bootstrapped.
- `loginRoute.loader` calls `getBootstrapStatus()` and redirects to `/bootstrap` if not yet bootstrapped. This creates a mutual redirect guard between the two routes.
- On submit, calls `postBootstrap(values)` directly (not `useMutation`) and navigates to `/login` on success. Server errors are shown inline via `useState<string | null>`.
- Uses `form.onSubmit(handleSubmit)` directly on the `<form>` element — does not use the `<Form>` component from `@helix/ui` (no need for `useBlocker` on a public screen).
- No `notify()` — errors are displayed inline, success is implicit via navigation.
