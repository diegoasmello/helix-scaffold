# permissions module — backend

Manages role-based permissions. Has no schema file for an entity with its own lifecycle — it reads and writes the `role_permissions` join table. Also exposes the static resource catalog and the current user's own grants.

## Data model

**Table**: `role_permissions` (`src/db/schema/role-permissions.ts`)

| Column     | DB type          | Notes                                          |
| ---------- | ---------------- | ---------------------------------------------- |
| `id`       | `text` PK        | UUIDv7                                         |
| `roleId`   | `text NOT NULL`  | FK → `roles.id` with `onDelete: 'cascade'`     |
| `resource` | `text NOT NULL`  | Resource string, e.g. `'todos'`, `'users'`     |
| `action`   | `text NOT NULL`  | Action string, e.g. `'view'`, `'create'`       |

Unique index on `(roleId, resource, action)` — no duplicate grants per role.

`onDelete: 'cascade'` means deleting a role automatically removes all its permission rows.

## Schema (`permissions-schema.ts`)

No entity schema for a "permission" object. The schemas are:

- `resourceDefinitionSchema` — `{ resource, label, actions: PermissionAction[] }`. Used for the catalog endpoint.
- `grantsSchema` — `Record<string, string[]>` — the shape `{ [resource]: action[] }`. Named ref `Grants`.
- `rolePermissionsResponseSchema` — `{ grants: Grants }`. Named ref `RolePermissionsResponse`. Used for all read/write endpoints on role permissions.

`PermissionAction` is imported from `src/config/permissions.ts`, not declared here.

## Service (`permissions-service.ts`)

`createPermissionsService(database)` returns `{ getByRoleId, replaceForRole, hasPermission }`.

**`getByRoleId(roleId)`** — selects all rows for the role and collapses them into a `Grants` object: `{ [resource]: action[] }`. Returns `{}` when the role has no permissions.

**`replaceForRole(roleId, grants)`** — runs inside a **single transaction**: deletes all existing rows for `roleId`, then bulk-inserts the new set. Returns the result of `getByRoleId` after the transaction. If `grants` is empty, the delete runs but no insert follows — the role ends up with no permissions.

**`hasPermission(roleId, resource, action)`** — point-lookup with `.limit(1)`. Returns `boolean`. Used by `createRequirePermission` (`src/hooks/require-permission.ts`) on every authenticated request.

## Routes (`permissions-routes.ts`)

Four endpoints across two URL namespaces:

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `GET` | `/permissions/resources` | none (authenticated only) | Returns the static `RESOURCE_DEFINITIONS` catalog |
| `GET` | `/me/permissions` | none (authenticated only) | Returns the current user's own grants |
| `GET` | `/roles/:id/permissions` | `permissions:view` | Returns grants for any role |
| `PUT` | `/roles/:id/permissions` | `permissions:edit` | Replaces all grants for a role |

**`GET /permissions/resources`** — no `requirePermission` guard, but it lives inside the `authenticated` scope so it still requires a valid session. Spreads `RESOURCE_DEFINITIONS` with `[...def.actions]` to convert the `readonly` tuple to a mutable array before serialisation.

**`GET /me/permissions`** — reads `request.sessionUser.roleId`; returns `{ grants: {} }` immediately when `roleId` is `null` (user has no role). No permission guard — every authenticated user needs this to function.

**`PUT /roles/:id/permissions`** — uses `PUT` (full replacement), not `PATCH`. The body is `{ grants: Grants }`, identical in shape to the response. No audit call — permission changes are not currently logged.

## `requirePermission` hook (`src/hooks/require-permission.ts`)

`createRequirePermission(database)` returns the `requirePermission` factory used as `preHandler` on every protected route across all modules. It calls `permissionsService.hasPermission(roleId, resource, action)` on each request — one DB query per protected route hit.

Returns `403` in two cases:
1. `request.sessionUser.roleId` is `null` or falsy — the user has no role at all.
2. The role exists but the specific `(resource, action)` row is absent.

## Permissions config

```ts
{ resource: 'permissions', label: 'Permissions', actions: ['view', 'edit'] }
```

Only `view` and `edit` — there is no `create` or `delete` action. Permissions are always managed as a whole set per role (replace), not created or deleted individually.

## Tests (`permissions-routes.test.ts`)

`beforeEach` truncates `cleanupUsers()` then `cleanupRoles()` — same FK order as the users module.

**`GET /permissions/resources`** — asserts shape only (`resource`, `label`, `actions` properties), not the exact list, so the test stays valid when new modules are added.

**`GET /me/permissions`** — tests two cases: authenticated user with a role (the `__test_admin__` role from `createTestSession`), and a freshly signed-up user with no role (returns `{ grants: {} }`).

**`GET /roles/:id/permissions`** — uses `createRoleWithPermissions` seeder; asserts with `expect.arrayContaining` (order of actions in the array is not guaranteed).

**`PUT /roles/:id/permissions`** — covers: replace with new grants, clear all grants with `{}`.

**Permission enforcement** is tested inline within the relevant `describe` blocks rather than in a separate `Permission enforcement` block — `GET /roles/:id/permissions` tests 403, `PUT /roles/:id/permissions` tests 403. The pattern differs slightly from other modules: some tests insert users directly via `testDb.insert(user)` instead of using the sign-up endpoint.

**`Bootstrap status` describe block** — a single sanity test verifying that `GET /bootstrap/status` returns `bootstrapped: true` while the test session user exists. This is an integration-level check that the bootstrap module still works alongside the permissions module, not a permissions-specific test.
