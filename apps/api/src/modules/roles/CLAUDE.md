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

`name` has a unique constraint (`roles_name_unique`). The service's `create()` and `update()` turn its violation into a `DomainError` — **409** `{ message: 'A role with this name already exists', code: 'name_taken' }` (via `getPgErrorConstraint`). The frontend shows it on the name field.

### `isDefault` invariant

Only one role can have `isDefault = true` at a time. This is enforced at two layers:

1. **DB**: partial unique index `roles_is_default_unique` on `(is_default) WHERE is_default = true` — the database rejects a second `true` row.
2. **Service**: `create()` and `update()` wrap in a transaction that first sets all existing `isDefault = true` rows to `false`, then applies the new value. This prevents the unique index from rejecting the new row before the old one is cleared.

When `registration.mode` is `'open'`, the User role created during bootstrap has `isDefault = true`. Self-registered users (HTTP sign-ups only — not `POST /users`) automatically receive this role via `databaseHooks.user.create.after` in `auth.ts`.

## Schema (`roles-schema.ts`)

- `roleSchema` — `.meta({ id: 'Role', title: 'Role' })`. `description` is `z.string().nullable()`. `isDefault` is `z.boolean()`.
- `createRoleSchema` — `{ name, description (optional), isDefault (optional, defaults to false) }`.
- `updateRoleSchema` — same fields, all optional.
- Sort columns: `['name', 'createdAt']`. Default sort: `createdAt`.

## Service (`roles-service.ts`)

`createRolesService(database)` returns `{ list, listAll, getById, hasUsers, create, update, remove }` — two methods beyond the standard five.

**`listAll()`** — returns all roles sorted by `name asc` with no pagination. Used by `GET /roles/all`. Always sorted alphabetically regardless of query params.

**`update(id, data, actorRoleId)` / `remove(id, actorRoleId)`** — receive the caller's role (`request.sessionUser.roleId`) and start with `assertRoleManageable()` from the permissions service: a role granting something the caller's role lacks answers **403** `role_not_editable` — no renaming it, deleting it or making it the default for self-registration (which would hand its permissions to every new sign-up). See `src/modules/permissions/CLAUDE.md` → _Privilege ceiling_. An unknown id passes the check (it grants nothing) and still ends in 404 / 204.

**`hasUsers(id)`** — point-lookup on the `user` table with `.limit(1)`: checks whether any user has `roleId = id`. Returns `boolean`. Called by `DELETE /roles/:id` before deletion.

## Routes (`roles-routes.ts`)

Receives `{ database, requirePermission }` — no `auth` parameter.

| Method   | Path         | Permission      | Notes                                                        |
| -------- | ------------ | --------------- | ------------------------------------------------------------ |
| `GET`    | `/roles`     | `roles:view`    | Paginated + sortable                                         |
| `GET`    | `/roles/all` | `roles:view`    | Plain array, sorted by name, no pagination params            |
| `GET`    | `/roles/:id` | `roles:view`    |                                                              |
| `POST`   | `/roles`     | `roles:create`  | **409** `name_taken` on a duplicate name. Audit: `request.audit('create', 'roles', id, body)` |
| `PATCH`  | `/roles/:id` | `roles:edit`    | **403** `role_not_editable` for a role above the caller's. **409** `name_taken` on a duplicate name. Audit: `request.audit('edit', 'roles', id, body)` |
| `DELETE` | `/roles/:id` | `roles:delete`  | **403** `role_not_editable` for a role above the caller's. Returns **409** when role has assigned users; audit on success |

**`DELETE` guard** — in `service.remove()`, which throws a `DomainError` before deleting:
1. `role?.isDefault` → `409 { message: 'Cannot delete the default registration role', code: 'default_role' }` — prevents silently breaking open registration.
2. `hasUsers(id)` → `409 { message: 'Cannot delete a role that has assigned users', code: 'role_in_use' }`.

No audit call on 409. Returns 204 even when the role id does not exist, but audits only when `service.remove` actually deleted a row (it returns a boolean).

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

**`describe('Privilege ceiling')`** — a moderator (`roles:view/edit/delete`, `todos:view`) against a broader and a narrower role: PATCH `isDefault` on the broader one (403, flag unchanged), DELETE it (403, row kept); both succeed on the narrower one.

Permission enforcement email pattern: `restricted-roles-${Date.now()}@test.com`.
