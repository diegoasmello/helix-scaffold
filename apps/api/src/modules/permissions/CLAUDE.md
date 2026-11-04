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

- `resourceDefinitionSchema` — `{ resource: PermissionResource, label, actions: PermissionAction[], requires }`. `requires` maps an action to its direct requirements (`PermissionRef[]` — `{ resource, action }`), from `PERMISSION_REQUIREMENTS` (`src/config/permissions.ts`, via `directRequirementsOf()`); an action without requirements has no key. Used for the catalog endpoint. `PermissionResource` is a named enum of the catalog's resources, so the generated client types the frontend's permission checks with it.
- `grantsSchema` — `Record<string, string[]>` — the shape `{ [resource]: action[] }`. Named ref `Grants`. Keys stay `string`: a role may still hold rows for a resource a fork has since removed from the catalog.
- `rolePermissionsResponseSchema` — `{ grants: Grants }`. Named ref `RolePermissionsResponse`. Used for all read/write endpoints on role permissions.

`PermissionAction` and `PermissionResource` are imported from `src/config/permissions.ts`, not declared here.

## Service (`permissions-service.ts`)

`createPermissionsService(database)` returns `{ getByRoleId, replaceForRole, hasPermission, grantsOf, exceeds, assertRoleManageable }`.

**`getByRoleId(roleId)`** — selects all rows for the role and collapses them into a `Grants` object: `{ [resource]: action[] }`. Returns `{}` when the role has no permissions.

**`replaceForRole(roleId, grants)`** — runs inside a **single transaction**: deletes all existing rows for `roleId`, then bulk-inserts the new set (duplicate actions within a resource are dropped, so they never hit the unique index). Returns the result of `getByRoleId` after the transaction. If `grants` is empty, the delete runs but no insert follows — the role ends up with no permissions.

**`hasPermission(roleId, resource, action)`** — point-lookup with `.limit(1)`. Returns `boolean`. Used by `createRequirePermission` (`src/hooks/require-permission.ts`) on every authenticated request.

### Privilege ceiling

Delegated moderation: a role may manage other roles and their permissions (`roles:*`, `permissions:edit`) without being able to climb to admin. **Nobody grants, or manages a role holding, more than their own role has.** The permissions that stay admin-only are simply the ones the admin does not give the moderator's role. The users module applies the same rule to accounts (`src/modules/users/CLAUDE.md` → _Privilege ceiling_).

- **`grantsOf(roleId)`** — the role's grants as a `Set` of `resource:action` strings; `null` → empty. Only catalog pairs count (`isDeclaredPermission()`): a leftover row for a removed resource gives no access, so it must not block anyone either.
- **`exceeds(roleId, actorGrants)`** — whether `roleId` grants a pair missing from `actorGrants`. An unknown role grants nothing, so it never exceeds (the caller's own 404 follows).
- **`assertRoleManageable(roleId, actorRoleId)`** — throws 403 `role_not_editable` when the role exceeds the actor's; returns the actor's grants. Called by `PUT /roles/:id/permissions` and by the roles service's `update` / `remove`.

A caller holding every permission (the bootstrap Admin) is never limited. A moderator may edit their own role, but only to remove: adding anything is a pair they lack.

## Routes (`permissions-routes.ts`)

Four endpoints across two URL namespaces:

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `GET` | `/permissions/resources` | none (authenticated only) | Returns the static `RESOURCE_DEFINITIONS` catalog |
| `GET` | `/me/permissions` | none (authenticated only) | Returns the current user's own grants |
| `GET` | `/roles/:id/permissions` | `permissions:view` | Returns grants for any role. `permissions:edit` alone does not open it — the requirement makes the editor grant both |
| `PUT` | `/roles/:id/permissions` | `permissions:edit` | Replaces all grants for a role |

**`GET /permissions/resources`** — no `requirePermission` guard, but it lives inside the `authenticated` scope so it still requires a valid session. Spreads `RESOURCE_DEFINITIONS` with `[...def.actions]` to convert the `readonly` tuple to a mutable array before serialisation.

**`GET /me/permissions`** — reads `request.sessionUser.roleId`; returns `{ grants: {} }` immediately when `roleId` is `null` (user has no role). No permission guard — every authenticated user needs this to function.

**`PUT /roles/:id/permissions`** — uses `PUT` (full replacement), not `PATCH`. The body is `{ grants: Grants }`, identical in shape to the response.

- **400** `{ message: 'Unknown permissions: <resource:action>, …' }` when any grant is not declared in `RESOURCE_DEFINITIONS` — checked by `findUnknownGrants()` (`src/config/permissions.ts`) before anything is written, so the request is all-or-nothing.
- **400** `missing_required_permissions` when a grant comes without what it requires (`PERMISSION_REQUIREMENTS`, checked by `findMissingRequirements()`; `message` lists the missing pairs) — `permissions:edit` without `permissions:view`, `users:edit` without `roles:view`. Checked after the privilege ceiling, so a refused grant answers 403 whatever else the body lacks. Grants saved before a requirement existed stay as they are until the role's permissions are saved again.
- **403** — privilege ceiling, checked after the `unknown_permissions` 400 and before anything is written: `role_not_editable` when the role grants something the caller's role lacks (even to remove grants from it), `permissions_not_grantable` when the body grants a pair the caller's role lacks (`message` lists them). `permission_denied` is `requirePermission()`'s.
- **404** `{ message: 'Role not found' }` for an unknown role id (Postgres FK violation, read with `getPgErrorCode`).
- **Audit:** `request.audit('edit', 'permissions', roleId, { grants })` after a successful replace.

## `requirePermission` hook (`src/hooks/require-permission.ts`)

`createRequirePermission(database)` returns the `requirePermission` factory used as `preHandler` on every protected route across all modules. It calls `permissionsService.hasPermission(roleId, resource, action)` on each request — one DB query per protected route hit.

The `RequirePermission` type (`src/types.ts`) accepts only pairs `RESOURCE_DEFINITIONS` declares (`<R extends PermissionResource>(resource: R, action: ResourceAction<R>)`). The factory also checks the pair with `isDeclaredPermission()` when the route registers and throws otherwise, so an undeclared pair stops the API at startup, like `requireSubscription()` with an unknown feature.

Returns `403` in two cases:
1. `request.sessionUser.roleId` is `null` or falsy — the user has no role at all.
2. The role exists but the specific `(resource, action)` row is absent.

## Permissions config

```ts
{ resource: 'permissions', label: 'Permissions', actions: ['view', 'edit'] }
```

Only `view` and `edit` — there is no `create` or `delete` action. Permissions are always managed as a whole set per role (replace), not created or deleted individually.

## Tests (`permissions-routes.test.ts`)

`beforeEach` runs `cleanupAuditLogs()`, then `cleanupUsers()` and `cleanupRoles()` — same FK order as the users module.

**`GET /permissions/resources`** — asserts shape only (`resource`, `label`, `actions`, `requires` properties), not the exact list, so the test stays valid when new modules are added; plus the `permissions` resource's `requires`.

**`GET /me/permissions`** — tests two cases: authenticated user with a role (the `__test_admin__` role from `createTestSession`), and a freshly signed-up user with no role (returns `{ grants: {} }`).

**`GET /roles/:id/permissions`** — uses `createRoleWithPermissions` seeder; asserts with `expect.arrayContaining` (order of actions in the array is not guaranteed).

**`PUT /roles/:id/permissions`** — covers: replace with new grants, clear all grants with `{}`, 400 for an unknown resource (and existing grants untouched), 400 for an undeclared action, 400 `missing_required_permissions` (and the role unchanged) and a body that brings its requirements, 404 for an unknown role, duplicate actions deduplicated, audit entry written.

**`describe('Privilege ceiling')`** — a moderator (`roles:view/edit`, `permissions:view/edit`, `todos:view/edit`) built with `createRoleWithPermissions` + `createSessionWithRole` (`src/test/helpers.ts`): grants what it holds to a lower role (200), a pair it lacks (403 `permissions_not_grantable`, the role unchanged), any change to a broader role (403 `role_not_editable`), raising its own role (403), no audit entry for a refusal.

**Permission enforcement** is tested inline within the relevant `describe` blocks rather than in a separate `Permission enforcement` block — `GET /roles/:id/permissions` tests 403, `PUT /roles/:id/permissions` tests 403. The pattern differs slightly from other modules: some tests insert users directly via `testDb.insert(user)` instead of using the sign-up endpoint.

**`Bootstrap status` describe block** — a single sanity test verifying that `GET /bootstrap/status` returns `bootstrapped: true` while the test session user exists. This is an integration-level check that the bootstrap module still works alongside the permissions module, not a permissions-specific test.

**`src/hooks/require-permission.test.ts`** — the hook on a bare Fastify app with a real catalog pair (`todos:view`): 403 `permission_denied` without a role or without the grant, the handler runs with it, and an undeclared pair (`todo:view`, `audit:edit`, through a cast) throws at registration.
