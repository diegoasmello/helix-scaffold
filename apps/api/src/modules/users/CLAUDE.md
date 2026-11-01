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
| `roleId`        | `text` (nullable FK)   | References `roles.id` — no cascade on update/delete |
| `createdAt`     | `timestamp NOT NULL`   | `defaultNow()`                                      |
| `updatedAt`     | `timestamp NOT NULL`   | `$onUpdateFn()`                                     |

`password` is **never** stored on the `user` table — better-auth manages it in the `account` table. It is accepted as input on create only and must never appear in any API response.

## Schemas (`users-schema.ts`)

Two entity shapes exist:

- `userSchema` — raw user fields without role embed. **No `.meta()`** — not emitted as a named ref.
- `userWithRoleSchema` — extends `userSchema` with `role: { id: string, name: string } | null`. Has `.meta({ id: 'UserWithRole', title: 'UserWithRole' })`. **Every `/users` endpoint returns this** — plain `userSchema` is only used by `GET /me` / `PATCH /me` in the `me` module.

`createUserSchema` — `{ name, email, password (min 8), roleId? (optional string) }`.  
`updateUserSchema` — `{ name?, email?, roleId?: string | null }`. `roleId: null` removes the role. Password change is **not** supported via this endpoint.

Sort columns: `['name', 'email', 'createdAt']`. Default sort: `createdAt`.

## Service (`users-service.ts`)

Factory signature: `createUsersService(database: Database, auth: Auth)` — receives `auth` as a second argument (unlike other modules).

**`list`, `listAll` and `getById`** do a `leftJoin(roles, eq(user.roleId, roles.id))` and pass the row through the private `toUserWithRole` helper. This helper aliases the join columns (`roleRefId`, `roleName`) to avoid collisions, then rebuilds `role: { id, name } | null`.

**`create`** flow:

1. If `roleId` is provided, validates the role exists via `validateRoleExists`. Throws `{ code: 'ROLE_NOT_FOUND' }` if not.
2. Calls `auth.api.signUpEmail({ body: { name, email, password } })` — never inserts directly into `user`.
3. If `roleId` was provided, updates the newly created user's `roleId` with a second `UPDATE`.
4. Returns the full `UserWithRole` via `getById`.

**`update`** flow:

1. If `roleId` is provided (and not `null`), validates the role exists. Throws `{ code: 'ROLE_NOT_FOUND' }` if not.
2. Updates the `user` row directly. Returns `null` when the user id does not exist (callers handle 404).
3. Returns the full `UserWithRole` via `getById`.

**`remove`** — hard deletes the `user` row and returns whether one existed. Sessions and accounts cascade via FK.

**`listAll`** — every user with its role, no pagination. Backs `GET /users/all`.

**No self-registration side effects:** `create` goes through `auth.api.signUpEmail`, which fires the `databaseHooks.user.create.after` hook in `auth.ts` — but a server-side call carries no request, so the hook skips it. An admin-created user gets exactly the `roleId` sent (`null` when omitted) and never a trial, in either registration mode. Covered by `registration/self-registration.test.ts`.

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

- `POST`: `409 { message: 'Email already in use' }` — caught from `better-auth`'s `APIError` with code `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`.
- `POST` / `PATCH`: `404 { message: 'Role not found' }` — caught from the service's `ROLE_NOT_FOUND` error code.

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
