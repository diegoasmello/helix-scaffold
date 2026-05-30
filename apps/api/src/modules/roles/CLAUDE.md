# roles module — backend

Full CRUD module. Used as a dependency by the users module (assigns `roleId` to users) and by the permissions module (`GET /roles/:id/permissions`, `PUT /roles/:id/permissions`). Exposes an extra non-paginated `/all` endpoint consumed by select fields in the frontend.

## Data model

**Table**: `roles` (`src/db/schema/roles.ts`)

| Column        | DB type              | Notes                                                        |
| ------------- | -------------------- | ------------------------------------------------------------ |
| `id`          | `text` PK            | UUIDv7                                                       |
| `name`        | `text NOT NULL`      | **Unique constraint** — no duplicate names                   |
| `description` | `text` (nullable)    | No `.notNull()` — absence and `null` are valid               |
| `isDefault`   | `boolean NOT NULL`   | Default `false`. At most one row can have `true` (partial unique index). |
| `createdAt`   | `timestamp NOT NULL` | `defaultNow()`                                               |
| `updatedAt`   | `timestamp NOT NULL` | `$onUpdateFn(() => new Date())`                              |

`name` has a unique index. Inserting a duplicate name causes a DB constraint error — currently not caught by the route handler (results in a 500). If deduplication feedback is needed, add a try/catch for the constraint violation.

### `isDefault` invariant

Only one role can have `isDefault = true` at a time. This is enforced at two layers:

1. **DB**: partial unique index `roles_is_default_unique` on `(is_default) WHERE is_default = true` — the database rejects a second `true` row.
2. **Service**: `create()` and `update()` wrap in a transaction that first sets all existing `isDefault = true` rows to `false`, then applies the new value. This prevents the unique index from rejecting the new row before the old one is cleared.

When `REGISTRATION_MODE=open`, the User role created during bootstrap has `isDefault = true`. Self-registered users automatically receive this role via `databaseHooks.user.create.after` in `auth.ts`.

## Schema (`roles-schema.ts`)

- `roleSchema` — `.meta({ id: 'Role', title: 'Role' })`. `description` is `z.string().nullable()`. `isDefault` is `z.boolean()`.
- `createRoleSchema` — `{ name, description (optional), isDefault (optional, defaults to false) }`.
- `updateRoleSchema` — same fields, all optional.
- Sort columns: `['name', 'createdAt']`. Default sort: `createdAt`.

## Service (`roles-service.ts`)

`createRolesService(database)` returns `{ list, listAll, getById, hasUsers, create, update, remove }` — two methods beyond the standard five.

**`listAll()`** — returns all roles sorted by `name asc` with no pagination. Used by `GET /roles/all`. Always sorted alphabetically regardless of query params.

**`hasUsers(id)`** — point-lookup on the `user` table with `.limit(1)`: checks whether any user has `roleId = id`. Returns `boolean`. Called by `DELETE /roles/:id` before deletion.

## Routes (`roles-routes.ts`)

Receives `{ database, requirePermission }` — no `auth` parameter.

| Method   | Path         | Permission      | Notes                                                        |
| -------- | ------------ | --------------- | ------------------------------------------------------------ |
| `GET`    | `/roles`     | `roles:view`    | Paginated + sortable                                         |
| `GET`    | `/roles/all` | `roles:view`    | Plain array, sorted by name, no pagination params            |
| `GET`    | `/roles/:id` | `roles:view`    |                                                              |
| `POST`   | `/roles`     | `roles:create`  | Audit: `request.audit('create', 'roles', id, body)`          |
| `PATCH`  | `/roles/:id` | `roles:edit`    | Audit: `request.audit('edit', 'roles', id, body)`            |
| `DELETE` | `/roles/:id` | `roles:delete`  | Returns **409** when role has assigned users; audit on success |

**`DELETE` guard**: two sequential 409 checks before `service.remove`:
1. `role?.isDefault` → `409 { message: 'Cannot delete the default registration role' }` — prevents silently breaking open registration.
2. `service.hasUsers(id)` → `409 { message: 'Cannot delete a role that has assigned users' }`.

No audit call on 409 — audit only fires after `service.remove` succeeds. Returns 204 even when the role id does not exist (Drizzle delete is a no-op on missing rows).

**`GET /roles/all`** — no pagination schema, no `buildPaginatedResponse`. Response is `z.array(roleSchema)`. The route handler is a one-liner: `async () => service.listAll()`.

## Permissions config

```ts
{ resource: 'roles', label: 'Roles', actions: ['view', 'create', 'edit', 'delete'] }
```

## Tests (`roles-routes.test.ts`)

**`beforeEach`** truncates `cleanupUsers()` then `cleanupRoles()` — FK order (users reference roles). `cleanupRoles()` preserves the `__test_admin__` role (uses `ne(roles.name, '__test_admin__')`), so it always exists in the test DB.

**`filterTestRole` helper** — all list assertions wrap `body.data` (or `res.json()`) with `filterTestRole(...)` to exclude the `__test_admin__` role from counts and ordering checks. Forgetting this will cause off-by-one failures on total counts and unexpected items in sorted results.

**`GET /roles/all`** — asserts exact alphabetical order (`alpha`, `beta`, `zeta`) after inserting three roles in a different order.

**`DELETE` 409 test** — seeds a role, inserts a user with `roleId` pointing to it, then asserts 409. Requires `testDb.insert(user).values({ id: uuidv7(), ..., roleId: inserted.id })`.

Permission enforcement email pattern: `restricted-roles-${Date.now()}@test.com`.
