# users module — backend

Full CRUD module. Differs significantly from other modules because user creation is delegated to **better-auth** and the underlying table (`user`) is owned by better-auth, not by a custom migration.

## Data model

**Table**: `user` (singular, not `users`) — defined in `src/db/schema/authentication.ts`, managed by better-auth.  
**No Postgres enum** — `emailVerified` is a plain boolean.

| Column          | DB type                | Notes                                               |
| --------------- | ---------------------- | --------------------------------------------------- |
| `id`            | `text` PK              | Set by better-auth (not `uuidv7`)                   |
| `name`          | `text NOT NULL`        |                                                     |
| `email`         | `text NOT NULL UNIQUE` |                                                     |
| `emailVerified` | `boolean NOT NULL`     | Default `false`                                     |
| `roleId`        | `text` (nullable FK)   | References `roles.id` — no cascade on update/delete; index `user_role_id_idx` |
| `createdAt`     | `timestamptz NOT NULL`   | `defaultNow()`                                      |
| `updatedAt`     | `timestamptz NOT NULL`   | `$onUpdateFn()`                                     |

`password` is **never** stored on the `user` table — better-auth manages it in the `account` table. It is accepted as input on create only and must never appear in any API response.

## Schemas (`users-schema.ts`)

Two entity shapes exist:

- `userSchema` (internal) — raw user fields without role embed. **No `.meta()`** — not emitted as a named ref. Only the base of `userWithRoleSchema`; no endpoint returns it.
- `userWithRoleSchema` — extends `userSchema` with `role: { id: string, name: string, isAdmin: boolean } | null` (`isAdmin` lets the web hide the admin account's actions). Has `.meta({ id: 'UserWithRole', title: 'UserWithRole' })`. **Every `/users` endpoint returns this**, and so do `GET /me` / `PATCH /me` in the `me` module.

`createUserSchema` — `{ name, email, password (min 8), roleId? (optional string) }`.  
`updateUserSchema` — `{ name?, email?, roleId?: string | null }`. `roleId: null` removes the role. Password change is **not** supported via this endpoint.

Sort columns: `['name', 'email', 'createdAt']`. Default sort: `createdAt`.

## Service (`users-service.ts`)

Factory signature: `createUsersService(database: Database, auth: Auth, config)` — receives `auth` and `config` for account provisioning (unlike other modules).

**`list`, `listAll` and `getById`** do a `leftJoin(roles, eq(user.roleId, roles.id))` and pass the row through the private `toUserWithRole` helper. The columns are the shared `USER_WITH_ROLE_COLUMNS`; the join ones are aliased (`roleRefId`, `roleName`, `roleIsAdmin`) to avoid collisions, and `toUserWithRole` rebuilds `role: { id, name, isAdmin } | null`.

**Privilege ceiling** — `create(data, actorRoleId)` and `update(id, data, actorRoleId)` receive the caller's role (`request.sessionUser.roleId`). A role *exceeds* the caller when it grants a catalog `resource:action` pair (`isDeclaredPermission()` — leftover rows for removed resources are ignored) that the caller's role does not — `grantsOf` / `exceeds` from the permissions service, which applies the same rule to roles (`src/modules/permissions/CLAUDE.md` → _Privilege ceiling_). So a user manager can never create or promote an account above their own role, nor take over a higher one. The admin is never limited by the ceiling, but the **admin role** (`src/modules/permissions/CLAUDE.md` → _Admin role_) sits above it, checked by `isAdminRole()` before the ceiling: it is never assigned (403 `admin_role_not_assignable` on `create` and `update`, the admin asking included), and its account is locked here for everyone (403 `admin_user_locked` on any `update` — a name edit included — and on `remove`); its owner edits it through `/me`. A role granted every permission therefore still cannot touch the admin.

**`create`** flow:

0. If `roleId` is the admin role → 403 `admin_role_not_assignable`; if it exceeds the caller → 403 `role_not_assignable`. Both before anything is written. An unknown `roleId` grants nothing, so it passes here and still ends in 404 `role_not_found`.
1. `provisionAccount(data)` (account provisioning, `src/modules/accounts/`) — validates the role (throws `RoleNotFoundError` — 404 `role_not_found` — before anything is written; a used email throws `EmailTakenError`, 409 `email_taken`), signs the user up through better-auth (never a direct insert) and assigns the role. A failed assignment deletes the user again, so no user is left without the role that was asked for.
2. Returns the full `UserWithRole` via `getById`.

**`update`** flow:

1. If `roleId` is provided (and not `null`), validates the role exists. Throws `RoleNotFoundError` (404 `role_not_found`) if not.
2. Loads the target's current `email` and `roleId`. Returns `null` when the user id does not exist (callers handle 404). A target holding the admin role → 403 `admin_user_locked`, whatever the body.
3. A role change to the admin role → 403 `admin_role_not_assignable`.
4. Privilege ceiling, **only when the request really changes the role** (`roleId` sent and different from the stored one, `null` included) **or the email** (different, case-insensitively). The web edit form always re-sends both unchanged, so a name-only edit is never refused:
   - the target's current role exceeds the caller → 403 `user_not_editable` (no rewriting a higher account's email, no demoting it);
   - the role changes to one that exceeds the caller → 403 `role_not_assignable` (no promoting yourself or anyone else).
5. Updates the `user` row directly, then returns the full `UserWithRole` via `getById`.

**`remove(id, actorRoleId)`** — returns `false` for an unknown id. Refuses (403) an admin account (`admin_user_locked`) and an account whose role exceeds the caller's (`user_not_editable` — the same ceiling as `update`), then hard deletes the `user` row. Sessions and accounts cascade via FK.

**`listAll`** — every user with its role, no pagination. Backs `GET /users/all`.

**No self-registration side effects:** `create` goes through `auth.api.signUpEmail`, which fires the `databaseHooks.user.create.after` hook in `auth.ts` — but a server-side call carries no request, so the hook skips it. An admin-created user gets exactly the `roleId` sent (`null` when omitted) and never a trial, in either registration mode. Covered by `accounts/account-provisioning.test.ts`.

## Routes (`users-routes.ts`)

Receives `{ database, auth, requirePermission }` — `auth` is an extra parameter not present in other modules.

| Method   | Path         | Permission     | Audit call                                                                               |
| -------- | ------------ | -------------- | ---------------------------------------------------------------------------------------- |
| `GET`    | `/users`     | `users:view`   | —                                                                                        |
| `GET`    | `/users/all` | `users:view`   | — (plain array, no pagination — for select fields, e.g. the subscriptions admin form)    |
| `GET`    | `/users/:id` | `users:view`   | —                                                                                        |
| `POST`   | `/users`     | `users:create` | `request.audit('create', 'users', id, meta)` — `meta` is the body **without** `password` |
| `PATCH`  | `/users/:id` | `users:edit`   | `request.audit('edit', 'users', id, body)`                                               |
| `DELETE` | `/users/:id` | `users:delete` | `request.audit('delete', 'users', id)`                                                   |

**Extra response codes** (beyond the standard 200/201/204/404):

Errors are `DomainError`s (see `apps/api/CLAUDE.md` → _Errors the client can act on_) — the handlers have no `try/catch`:

- `POST` / `PATCH`: `409 { message: 'Email already in use', code: 'email_taken' }` — `EmailTakenError`. On `POST`, account provisioning maps better-auth's `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`; on `PATCH`, the service maps the `user_email_unique` violation (it used to be a 500).
- `POST` / `PATCH`: `404 { message: 'Role not found', code: 'role_not_found' }` — `RoleNotFoundError`.
- `PATCH`: `404 { message: 'User not found', code: 'user_not_found' }` for an unknown id.
- `POST` / `PATCH`: `403` with `code: 'admin_role_not_assignable'` (the admin role), `'role_not_assignable'` (the role exceeds the caller's) and, on `PATCH`, `'admin_user_locked'` (the target is the admin) or `'user_not_editable'` (the target's role exceeds the caller's) — see _Privilege ceiling_.
- `DELETE`: `403` with `code: 'admin_user_locked'` or `'user_not_editable'`, same rules. `requirePermission()`'s `permission_denied` shares the status.

**Audit on POST**: password is stripped before logging — `const { password: _, ...meta } = request.body`.

`DELETE` returns `204` even when the id does not exist, but audits only a real deletion.

## Permissions config

Resource registered in `src/config/permissions.ts`:

```ts
{ resource: 'users', label: 'Users', actions: ['view', 'create', 'edit', 'delete'] }
```

## Tests (`users-routes.test.ts`)

**`beforeEach`** truncates `cleanupUsers()` then `cleanupRoles()` — this order is required because `user.roleId` is a FK to `roles.id`. Reversing the order causes a constraint violation.

**No "empty list" test** — `GET /users` always returns at least the authenticated test user created in `beforeAll`. The baseline test asserts 1 user and verifies `password` is absent.

**Seeding users directly**: `testDb.insert(user).values({ id: uuidv7(), name, email, emailVerified: false })` — the `id` must be set explicitly (no DB default) and `emailVerified` must be provided (no default in Drizzle, though the DB has one).

**`POST /users`** tests cover: no role (201, `role: null`), with valid `roleId` (201, embedded role), non-existent `roleId` (404), duplicate email (409), invalid body (400).

**`PATCH /users/:id`** tests cover: unknown id (404), name update (fields preserved), assign role, remove role (`roleId: null`), non-existent `roleId` (404).

Permission enforcement email pattern: `restricted-users-${Date.now()}@test.com`.

**`describe('Privilege ceiling')`** — a user manager (`users:view/create/edit`) against the test admin and a `todos:view` peer: POST with a broader role (403, no user written), with a narrower one (201), unknown role (still 404); PATCH self to a broader role (403, role unchanged, no audit), an admin's email (403), demoting or re-emailing the peer (403), a name edit re-sending the unchanged email and role like the form (200), assigning a narrower role (200). Roles are inserted with explicit names — `createRoleWithPermissions()` names them by `Date.now()`, which collides when one test creates several.

**`describe('Admin account')`** — with `createAdminRole()`, against the test session (every permission, not the admin role): `role.isAdmin` embedded; POST with the admin role (403 `admin_role_not_assignable`, nothing created — also when the admin asks); PATCH promoting a user to it (403, role unchanged); any PATCH of the admin, a name edit included (403 `admin_user_locked`, no audit); DELETE of the admin (403, kept, no audit — also the admin deleting themselves).

**`describe('Privilege ceiling on DELETE /users/:id')`** — a `users:view/delete` role: deleting the broader test user (403 `user_not_editable`, kept), deleting a peer with the same role (204, audited).
