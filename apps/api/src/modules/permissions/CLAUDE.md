# permissions module — backend

Manages role-based permissions. Has no schema file for an entity with its own lifecycle — it reads and writes the `role_permissions` join table. Also exposes the static resource catalog and the current user's own grants.

## Data model

**Table**: `role_permissions` (`src/db/schema/role-permissions.ts`)

| Column     | DB type         | Notes                                      |
| ---------- | --------------- | ------------------------------------------ |
| `id`       | `text` PK       | UUIDv7                                     |
| `roleId`   | `text NOT NULL` | FK → `roles.id` with `onDelete: 'cascade'` |
| `resource` | `text NOT NULL` | Resource string, e.g. `'todos'`, `'users'` |
| `action`   | `text NOT NULL` | Action string, e.g. `'view'`, `'create'`   |

Unique index on `(roleId, resource, action)` — no duplicate grants per role.

`onDelete: 'cascade'` means deleting a role automatically removes all its permission rows.

## Schema (`permissions-schema.ts`)

No entity schema for a "permission" object. The schemas are:

- `resourceDefinitionSchema` — `{ resource: PermissionResource, label, actions: PermissionAction[], requires }`. `requires` maps an action to its direct requirements (`PermissionRef[]` — `{ resource, action }`), from `PERMISSION_REQUIREMENTS` (`src/config/permissions.ts`, via `directRequirementsOf()`); an action without requirements has no key. Used for the catalog endpoint. `PermissionResource` is a named enum of the catalog's resources, so the generated client types the frontend's permission checks with it.
- `grantsSchema` — `Record<string, string[]>` — the shape `{ [resource]: action[] }`. Named ref `Grants`. Keys stay `string`: a role may still hold rows for a resource a fork has since removed from the catalog.
- `rolePermissionsResponseSchema` — `{ grants: Grants }`. Named ref `RolePermissionsResponse`. Used for all read/write endpoints on role permissions.

`PermissionAction` and `PermissionResource` are imported from `src/config/permissions.ts`, not declared here.

## Service (`permissions-service.ts`)

`createPermissionsService(database)` returns `{ isAdminRole, getByRoleId, replaceForRole, hasPermission, grantsOf, exceeds, assertRoleManageable, isRoleManageable }`.

**`isAdminRole(roleId)`** — whether the role is the admin role (`roles.isAdmin`); `null` or an unknown id → `false`. See _Admin role_.

**`getByRoleId(roleId)`** — one query (`roles` left-joined to its `role_permissions` rows) collapsed into a `Grants` object: `{ [resource]: action[] }`. Returns `{}` when the role has no permissions or does not exist. For the admin role it returns the whole catalog (`ALL_PERMISSIONS`), whatever rows it has — so `GET /me/permissions`, `GET /roles/:id/permissions` and `grantsOf()` all see it holding everything. For any other role it skips the rows of an admin-only permission (see _Admin-only permissions_).

**`replaceForRole(roleId, grants)`** — runs inside a **single transaction**: deletes all existing rows for `roleId`, then bulk-inserts the new set (duplicate actions within a resource are dropped, so they never hit the unique index). Returns the result of `getByRoleId` after the transaction. If `grants` is empty, the delete runs but no insert follows — the role ends up with no permissions.

**`hasPermission(roleId, resource, action)`** — one query (`roles` left-joined to the matching `role_permissions` row, `.limit(1)`): `true` when the row exists and the pair is not admin-only (`isAdminOnlyPermission()`), or when the role is the admin role and the pair is in the catalog (`isDeclaredPermission()`). Used by `createRequirePermission` (`src/hooks/require-permission.ts`) on every authenticated request, by the entitlements' operator check and by upload access.

### Admin role

The role with `roles.isAdmin = true` (partial unique index `roles_is_admin_unique`: one at most). Only the bootstrap (`provisionFirstAdmin()`) and the seed create it; `isAdmin` is in the `Role` response but in no request body, so the API never sets it.

- **Every permission, implicitly** — `hasPermission()` and `getByRoleId()` answer from the catalog, not from `role_permissions` (the admin role has no rows; a reused leftover's are deleted). A module added to `RESOURCE_DEFINITIONS` is the admin's at once, with no grant and no re-bootstrap.
- **Locked for everyone, the admin included** — `assertRoleManageable()` refuses it first with 403 `admin_role_locked`: no `PUT /roles/:id/permissions`, no `PATCH /roles/:id` (name, description, `isDefault`), no `DELETE /roles/:id`.
- **Never assigned** — `POST /users` and `PATCH /users/:id` refuse it as `roleId` with 403 `admin_role_not_assignable`, whoever asks.
- **Its account is locked in `/users`** — any `PATCH /users/:id` (a name edit included) and `DELETE /users/:id` of a user holding it answer 403 `admin_user_locked`; the admin edits their own account through `/me`. See `src/modules/users/CLAUDE.md`.
- **Above the ceiling** — a role granted every permission (a moderator given everything, or the tests' `__test_admin__`) holds the same pairs, so the privilege ceiling alone would make it the admin's equal. These checks are by `isAdmin`, not by grants, and run before the ceiling.

There is no way yet to hand the admin role to another account: a second admin, or a transfer, needs a direct database change.

### Admin-only permissions

`ADMIN_ONLY_PERMISSIONS` (`src/config/permissions.ts`) lists the pairs only the admin role holds — never granted to another role, whoever asks, the admin included. Today `users:password`: setting another user's password (`PUT /users/:id/password`) hands over that account, so no delegated role may do it. Such a pair is in `RESOURCE_DEFINITIONS` like any other (the types, `requirePermission()` and the admin's `ALL_PERMISSIONS` see it), but:

- `GET /permissions/resources` leaves it out (`enabledResourceDefinitions()`), so the role editor never shows it;
- `PUT /roles/:id/permissions` refuses it with **400** `unknown_permissions` (`findAdminOnlyGrants()`), as a typo or a resource turned off;
- a row a role holds anyway (written to the database by hand, or by an old seed) gives nothing: `hasPermission()` answers `false` and `getByRoleId()` leaves it out, so neither `GET /me/permissions` nor the privilege ceiling count it;
- no `PERMISSION_REQUIREMENTS` entry may name it, as a key or a value — the catalog check throws at startup otherwise.

The admin holds it through `isAdmin`, like the rest of the catalog: `GET /me/permissions` and `GET /roles/:id/permissions` of the admin role list it. To make another pair admin-only, add it to `ADMIN_ONLY_PERMISSIONS`; nothing else changes.

### Privilege ceiling

Delegated moderation: a role may manage other roles and their permissions (`roles:*`, `permissions:edit`) without being able to climb to admin. **Nobody grants, or manages a role holding, more than their own role has.** The permissions that stay admin-only are simply the ones the admin does not give the moderator's role. The users module applies the same rule to accounts (`src/modules/users/CLAUDE.md` → _Privilege ceiling_).

- **`grantsOf(roleId)`** — the role's grants as a `Set` of `resource:action` strings; `null` → empty. Only catalog pairs count (`isDeclaredPermission()`): a leftover row for a removed resource gives no access, so it must not block anyone either.
- **`exceeds(roleId, actorGrants)`** — whether `roleId` grants a pair missing from `actorGrants`. An unknown role grants nothing, so it never exceeds (the caller's own 404 follows).
- **`assertRoleManageable(roleId, actorRoleId)`** — throws 403 `admin_role_locked` for the admin role (see _Admin role_), then 403 `role_not_editable` when the role exceeds the actor's; returns the actor's grants. Called by `PUT /roles/:id/permissions` and by the roles service's `update` / `remove`.
- **`isRoleManageable(roleId, actorRoleId)`** — the same decision as a boolean, never throwing: `GET /roles/:id` returns it as `manageable`. Clients read it instead of comparing grants themselves — `GET /roles/:id/permissions` leaves out the rows the ceiling still counts (resources turned off) and keeps rows it ignores (pairs no longer in the catalog).

The admin is never limited by the ceiling (their grants are the whole catalog), but is bound by the admin-role locks like everyone else. A moderator may edit their own role, but only to remove: adding anything is a pair they lack.

## Routes (`permissions-routes.ts`)

Four endpoints across two URL namespaces:

| Method | Path                     | Permission                | Notes                                                                                                                |
| ------ | ------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/permissions/resources` | none (authenticated only) | Returns the `RESOURCE_DEFINITIONS` catalog, minus the resources turned off (see _Resources turned off_)              |
| `GET`  | `/me/permissions`        | none (authenticated only) | Returns the current user's own grants                                                                                |
| `GET`  | `/roles/:id/permissions` | `permissions:view`        | Returns grants for any role. `permissions:edit` alone does not open it — the requirement makes the editor grant both |
| `PUT`  | `/roles/:id/permissions` | `permissions:edit`        | Replaces all grants for a role                                                                                       |

**`GET /permissions/resources`** — no `requirePermission` guard, but it lives inside the `authenticated` scope so it still requires a valid session. Serves `enabledResourceDefinitions(config)` — the catalog minus the resources turned off (see _Resources turned off_) and the admin-only actions (see _Admin-only permissions_).

### Resources turned off

A resource listed in `RESOURCE_TOGGLES` (`src/config/permissions.ts`) exists only while a setting of `app.config.ts` is on — today `subscriptions`, with `subscriptions.enabled`. While it is off, the role editor works as if the resource were not in the catalog, so the web shows no checkbox for it without checking the config itself:

- `GET /permissions/resources` leaves it out.
- `GET /roles/:id/permissions` and the `PUT` response leave its grants out — the admin role's too.
- `PUT /roles/:id/permissions` refuses a grant for it with **400** `unknown_permissions`.
- The rows a role already holds for it are **kept** on `PUT` — the route adds them to the body before `replaceForRole()`: turning the setting back on gives the roles the grants they had. Minus the ones whose requirements the body no longer brings (`dropUnmetRequirements()`, repeated until none is left): with `users:view` unchecked, a kept `subscriptions:create` goes too — what the editor does with what it shows. A kept grant never makes the `PUT` answer `missing_required_permissions` about a pair the editor does not show.

The route only calls the helpers of `src/config/permissions.ts`, next to `findUnknownGrants()`: `enabledResourceDefinitions(config)`, `findDisabledGrants(grants, config)`, `withoutDisabledResources(grants, config)`, `onlyDisabledResources(grants, config)` and `dropUnmetRequirements(grants, kept) → { kept, dropped }`.

It stays in `RESOURCE_DEFINITIONS`, so the generated types, `requirePermission()`'s startup check and `GET /me/permissions` (the admin still holds every pair) do not depend on the config. The privilege ceiling still counts kept rows, on purpose: a moderator without `subscriptions:*` cannot edit, delete or assign a role that keeps some, nor manage an account holding it (`role_not_editable`, `role_not_assignable`, `user_not_editable`), although the editor shows only pairs they have. Ignoring them would let that moderator hand such a role to an account of theirs while the setting is off and gain the hidden grants when it comes back on. Only grants made before the setting was turned off are concerned.

To make another module's resource conditional, add `<resource>: (config) => …` to `RESOURCE_TOGGLES`. A requirement may point at a toggled resource only from that same resource (`subscriptions:create` → `subscriptions:view`, never `users:edit` → `subscriptions:view`, which could not be granted while it is off): `findRequirementsOnToggledResources()` checks `PERMISSION_REQUIREMENTS` when the catalog loads, and a wrong one stops the API at startup. Unit tests of these helpers: `src/config/permissions.test.ts`.

**`GET /me/permissions`** — reads `request.sessionUser.roleId`; returns `{ grants: {} }` immediately when `roleId` is `null` (user has no role). No permission guard — every authenticated user needs this to function.

**`PUT /roles/:id/permissions`** — uses `PUT` (full replacement), not `PATCH`. The body is `{ grants: Grants }`, identical in shape to the response.

- **400** `unknown_permissions` (`message`: `Unknown permissions: <resource:action>, …`) when any grant is not declared in `RESOURCE_DEFINITIONS` (`findUnknownGrants()`), belongs to a resource turned off (`findDisabledGrants()`) or is admin-only (`findAdminOnlyGrants()`) — all in `src/config/permissions.ts`, checked before anything is written, so the request is all-or-nothing.
- **400** `missing_required_permissions` when a grant comes without what it requires (`PERMISSION_REQUIREMENTS`, checked by `findMissingRequirements()`; `message` lists the missing pairs) — `permissions:edit` without `permissions:view`, `users:edit` without `roles:view`. Checked after the privilege ceiling, so a refused grant answers 403 whatever else the body lacks. Grants saved before a requirement existed stay as they are until the role's permissions are saved again.
- **403** — admin role and privilege ceiling, checked after the `unknown_permissions` 400 and before anything is written: `admin_role_locked` for the admin role (even from the admin), `role_not_editable` when the role grants something the caller's role lacks (even to remove grants from it), `permissions_not_grantable` when the body grants a pair the caller's role lacks (`message` lists them). `permission_denied` is `requirePermission()`'s.
- **404** `{ message: 'Role not found' }` for an unknown role id (Postgres FK violation, read with `getPgErrorCode`).
- **Audit:** `request.audit('edit', 'permissions', roleId, { grants, kept?, dropped? })` after a successful replace. `grants` is the body; `kept` and `dropped` (same shape, only when non-empty) are the grants of resources turned off that the role kept or lost (see _Resources turned off_) — the role ends up with `grants` plus `kept`.

## `requirePermission` hook (`src/hooks/require-permission.ts`)

`createRequirePermission(database)` returns the `requirePermission` factory used as `preHandler` on every protected route across all modules. It calls `permissionsService.hasPermission(roleId, resource, action)` on each request — one DB query per protected route hit.

The `RequirePermission` type (`src/types.ts`) accepts only pairs `RESOURCE_DEFINITIONS` declares (`<R extends PermissionResource>(resource: R, action: ResourceAction<R>)`). The factory also checks the pair with `isDeclaredPermission()` when the route registers and throws otherwise, so an undeclared pair stops the API at startup, like `requireSubscription()` with an unknown feature.

Returns `403` in two cases:

1. `request.sessionUser.roleId` is `null` or falsy — the user has no role at all.
2. The role exists but the specific `(resource, action)` row is absent — and the role is not the admin role.

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

**`describe('Subscriptions turned off')`** — a second app built with `createTestApp({ subscriptions: { enabled: false } })`, using the same session: the catalog has no `subscriptions`, `GET /roles/:id/permissions` hides a role's subscription grants, `PUT` refuses them (400, nothing written), a `PUT` without them keeps the rows the role had (read back through the enabled app), drops a kept `subscriptions:create` when the body leaves out `users:view` — and keeps it when the body brings it — and audits `kept` and `dropped`. The admin role is shown without `subscriptions`, and a moderator holding every pair the editor shows still gets 403 `role_not_editable` on a role keeping `subscriptions:view`.

**`describe('Admin-only permissions')`** — `users:password` absent from the catalog, held by the admin's `GET /me/permissions` and not by the test session (every grantable permission), refused by `PUT` even from the admin (400, no audit), and a row written by hand hidden from `GET /roles/:id/permissions`. The unit tests of `isAdminOnlyPermission()`, `findAdminOnlyGrants()` and the editor's catalog are in `src/config/permissions.test.ts`.

**`describe('Admin role')`** — built with `createAdminRole()` (`src/test/helpers.ts`): `GET /roles/:id/permissions` and the admin's own `GET /me/permissions` list the whole catalog with no rows; `PUT` on it answers 403 `admin_role_locked` to the test session (every permission) and to the admin, with no audit entry.

**`describe('Privilege ceiling')`** — a moderator (`roles:view/edit`, `permissions:view/edit`, no `roles:delete`) built with `createRoleWithPermissions` + `createSessionWithRole` (`src/test/helpers.ts`): grants what it holds to a lower role (200), a pair it lacks (403 `permissions_not_grantable`, the role unchanged), any change to a broader role (403 `role_not_editable`), raising its own role (403), no audit entry for a refusal.

**Permission enforcement** is tested inline within the relevant `describe` blocks rather than in a separate `Permission enforcement` block — `GET /roles/:id/permissions` tests 403, `PUT /roles/:id/permissions` tests 403. The pattern differs slightly from other modules: some tests insert users directly via `testDb.insert(user)` instead of using the sign-up endpoint.

**`Bootstrap status` describe block** — a single sanity test verifying that `GET /bootstrap/status` returns `bootstrapped: true` while the test session user exists. This is an integration-level check that the bootstrap module still works alongside the permissions module, not a permissions-specific test.

**`src/hooks/require-permission.test.ts`** — the hook on a bare Fastify app with a real catalog pair (`audit:view`): 403 `permission_denied` without a role or without the grant, the handler runs with it, and an undeclared pair (`user:view`, `audit:edit`, through a cast) throws at registration.
