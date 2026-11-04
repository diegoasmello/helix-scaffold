# roles module — frontend

Full CRUD module. Also owns the permission editor (`/roles/$id/permissions`) — there is no separate permissions module in the frontend — and exports two cross-module components: `RoleSelectField` and `RoleCreateDrawer`.

## File structure

```
src/modules/roles/
├── types.ts
├── validation.ts
├── validation.test.ts
├── permission-requirements.ts       ← checks/unchecks permissions with their requirements (catalog `requires`)
├── permission-requirements.test.ts
├── components/
│   ├── roles-form.tsx               ← shared form fields (create + edit)
│   ├── roles-form.test.tsx
│   ├── role-select-field.tsx        ← cross-module Select component
│   ├── role-select-field.test.tsx
│   ├── role-create-drawer.tsx       ← cross-module creation drawer (used by role-select-field)
│   ├── role-create-drawer.test.tsx
│   ├── permissions-tree.tsx         ← checkbox tree of resource × action grants (read-only on detail)
│   ├── permissions-tree.test.tsx
│   └── permissions-editor.tsx       ← loads + saves a role's grants (PUT /roles/:id/permissions)
└── routes/
    ├── index.ts
    ├── roles-pending.tsx
    ├── roles-list.tsx
    ├── roles-list.test.tsx
    ├── roles-create.tsx
    ├── roles-create.test.tsx
    ├── roles-detail.tsx
    ├── roles-detail.test.tsx
    ├── roles-edit.tsx
    ├── roles-edit.test.tsx
    ├── roles-permissions.tsx        ← wraps PermissionsEditor in a PageEdit
    └── roles-permissions.test.tsx   ← also covers PermissionsEditor (no separate test file)
```

## Types (`types.ts`)

| Alias             | Source (`@helix/api-client/types`) |
| ----------------- | ---------------------------------- |
| `RoleItem`        | `Role`                             |
| `CreateRoleInput` | `PostRolesMutationRequest`         |
| `UpdateRoleInput` | `PatchRolesIdMutationRequest`      |

`RoleFormValues` is a form-specific interface:

```ts
interface RoleFormValues {
  name: string
  description: string  // always a string — never null in the form
  isDefault: boolean   // the role self-registered users receive (open registration)
}
```

`description` is nullable in the API (`Role.description: string | null`) but the form always uses a string. The edit screen initialises it as `item.description ?? ''`. When saved, the non-null string is always sent to the API — the backend accepts it as optional.

## Validation (`validation.ts`)

Single validator `roleFormValidate` used for both create and edit:

```ts
name:        required, max 100 chars
description: required, max 300 chars
```

Note: `description` is required by the form validator even though the API schema marks it as optional. This is a stricter client-side constraint — the form always sends a description.

## Form fields (`components/roles-form.tsx`)

| Field         | Component  | Notes                                              |
| ------------- | ---------- | -------------------------------------------------- |
| `name`        | `TextInput`| `getInputProps`                                    |
| `description` | `Textarea` | `resize="vertical"`                                |
| `isDefault`   | `Switch`   | `getInputProps('isDefault', { type: 'checkbox' })` |

Turning `isDefault` on for one role unsets it on the previous default — the API does it in a transaction (only one default role can exist).

**`isDefault` exists only in open registration.** Only self-registered users receive the default role, so `RolesForm` renders the switch, and `RolesDetail` the "Default for new users" value, only when `useRegistrationOpen()` (`src/modules/auth/use-registration-open.ts`, over `GET /registration/status`) is `true` — hidden while it loads. In closed mode the form keeps the role's current value (`false` on create) and sends it unchanged. The create, edit and detail loaders prefetch `registrationStatusQueryOptions()` so the switch never pops in; `RoleCreateDrawer` (inside the users pages) reads the same cache and fetches it on first open otherwise.

The fields sit in one `FormColumn` (no sections), so the same `RolesForm` serves the create and edit pages and `RoleCreateDrawer`. No `isEditing` prop — the form is identical for create and edit.

## `RoleSelectField` (`components/role-select-field.tsx`)

Cross-module component exported for use by other modules. Wraps a `<Select>` backed by `useGetRolesAllSuspense()` (consumes `GET /roles/all`). Props are `Omit<SelectProps, 'data'> & { allowCreate?: boolean }`.

Always `searchable` and `clearable`. Selecting nothing returns `null`. **Never offers the admin role** (`role.isAdmin` — the API refuses it with `admin_role_not_assignable`). Callers must ensure `getRolesAllSuspenseQueryOptions()` is prefetched in the route loader or the component will suspend on its own.

**Basic usage** — bind it like any input:

```tsx
<RoleSelectField {...form.getInputProps('roleId')} />
```

**With inline creation** (`allowCreate`): renders the select followed by a "Create related role" button below it. Clicking the button opens `RoleCreateDrawer`. On successful creation the new role is automatically selected.

```tsx
<RoleSelectField allowCreate {...form.getInputProps('roleId')} />
```

## `RoleCreateDrawer` (`components/role-create-drawer.tsx`)

Cross-module drawer that renders a full role creation form (`RolesForm`) inside a Mantine `Drawer`. Used internally by `RoleSelectField` when `allowCreate` is true — consuming modules do not import it directly.

Props: `opened`, `onClose`, `onSuccess(roleId)`. On success: `resourceCache.changed('roles')` — refreshes `/roles/all` behind `RoleSelectField` (and the `/roles` pages), then calls `onSuccess` with the created role's ID.

## Routes (`routes/index.ts`)

| Constant           | Path               | Permission     |
| ------------------ | ------------------ | -------------- |
| `rolesListRoute`   | `/roles`           | `roles:view`   |
| `rolesCreateRoute` | `/roles/create`    | `roles:create` |
| `rolesDetailRoute` | `/roles/$id`       | `roles:view`   |
| `rolesEditRoute`   | `/roles/$id/edit`  | `roles:edit`   |
| `rolesPermissionsRoute` | `/roles/$id/permissions` | `roles:view` + `permissions:view` + `permissions:edit` (it loads the role and its grants before saving) |

The edit and permissions loaders go through `loadManageableRole(id)`: it awaits the role and, for the admin role, throws `redirect` to `/roles/$id` — the page could only fail on save (`admin_role_locked`).

`rolesListRoute` validateSearch: `page` (default 1), `pageSize` (default 10), `sortBy` (enum `name | createdAt`, optional), `sortOrder` (default `'desc'`).

No `/roles/all` route — `GET /roles/all` is only consumed internally by `RoleSelectField`.

## Data fetching

- List: `useGetRolesSuspense({ page, pageSize, sortBy, sortOrder })`
- Detail/Edit: `useGetRolesIdSuspense(id)`
- Role select (in `RoleSelectField`): `useGetRolesAllSuspense()` — different query key from the paginated list

## Mutations

Inline in each component — no `hooks.ts`.

**Duplicate name**: create, edit and `RoleCreateDrawer` check `apiErrorCode(error) === 'name_taken'` (`src/lib/api-errors.ts`) in `onError` and put `form.name.taken` on the name field (`form.setFieldError`) instead of the generic notification.

**Refused deletion**: `RolesList` notifies `apiErrorMessage(error, 'roles', 'notifications.deleteFailed')` — `errors.default_role` / `errors.role_in_use` explain why. `errors.role_not_found` covers a role deleted meanwhile (permission editor).

**Admin role** (API: `apps/api/src/modules/permissions/CLAUDE.md` → _Admin role_): `role.isAdmin` marks the admin role — every permission, locked for everyone. `RolesList` shows a "Full access" badge (`admin.badge`) next to its name and only View in its row; `RolesDetail` shows no actions and an `Alert` (`admin.title`, `admin.description`) instead, its grants (the whole catalog, from the API) still read-only below; its edit and permissions pages redirect to the detail. `errors.admin_role_locked` covers a refusal anyway.

**Privilege ceiling** (API: `apps/api/src/modules/permissions/CLAUDE.md` → _Privilege ceiling_): a delegated moderator cannot change, delete or grant beyond their own role. `RolesEdit`, `RolesList` (delete) and the permission editor notify through `apiErrorMessage`, so `errors.role_not_editable` (a role above theirs) and `errors.permissions_not_grantable` (a permission they lack) explain the refusal. The editor still shows every checkbox: the API is the one that decides.

**Create**: `resourceCache.changed('roles')`.  
**Update**: `resourceCache.saved('roles', updated)`.  
**Delete** (in `RolesList`): `onError` on `useMutation` itself (not on `mutate`) — notifies on failure. Confirm message includes the role's name: `Are you sure you want to delete "${name}"?`. `resourceCache.removed('roles', id)`.

**Cache** — every role mutation goes through the resource cache (`src/lib/resource-cache.ts`), which refreshes all role queries (`/roles` pages, `/roles/all`, details, `/roles/:id/permissions`) plus `/users` (users embed the role name) and `/me/permissions`. The create screen and `RoleCreateDrawer` therefore refresh the same queries.

## RBAC in the list screen

`RolesList` gates its actions by permission:

- Create button → `<HasPermission resource="roles" action="create">`
- Row actions (`RowActions`): View (always), Edit (`hidden: !hasPermission('roles', 'edit')`), Edit permissions (`hidden: !hasPagePermission(ROLES_ACCESS.permissions, hasPermission)` — the editor page's whole access), Delete (`hidden: !hasPermission('roles', 'delete')`, `danger: true`)

With all four allowed, the row shows the "⋯" menu; with 3 or fewer, text buttons — the tests cover both. The admin role's row hides Edit, Edit permissions and Delete whatever the user may do (`item.isAdmin || ...`), so it shows View alone.

## List test (`routes/roles-list.test.tsx`)

The router mock targets the local route index (`'.'`), not `@tanstack/react-router`:

```ts
vi.mock('.', () => ({
  rolesListRoute: {
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 10, sortOrder: 'desc' }),
  },
}))
```

This avoids the circular dependency that would occur when mocking `@tanstack/react-router` for a component that imports its own route constant from the same index file.

The list handler is called with a `createPaginatedRoles({...})` object — not a plain array.

## Permission editor

`RolesDetail` (`roles:view`) shows the role and, only with `permissions:view`, its grants read-only (`RoleGrants`, a child component holding the grants and catalog queries, inside `<HasPermission resource="permissions" action="view">`; the loader prefetches them under the same check). Without it the page shows the role alone and never calls `GET /roles/:id/permissions`, which would answer 403. The button to `/roles/$id/permissions` shows with `hasPagePermission(ROLES_ACCESS.permissions, hasPermission)`.

`rolesPermissionsRoute` (`/roles/$id/permissions`, guarded by `ROLES_ACCESS.permissions` — `roles:view`, `permissions:view` and `permissions:edit`) renders `RolesPermissions`: a `PageEdit` around `<PermissionsEditor roleId onCancel>`. Its loader awaits the role (for the breadcrumb) and prefetches the catalog and the grants.

**`PermissionsEditor`** (`components/permissions-editor.tsx`):

- Reads `useGetRolesIdPermissionsSuspense(roleId)` (saved grants) and `useGetPermissionsResourcesSuspense()` (the `RESOURCE_DEFINITIONS` catalog).
- Holds edits in local state (`useState(saved.grants)`); nothing is sent until Save.
- Save → `putRolesIdPermissions(roleId, { grants })` (full replacement). `onSuccess` writes the result with `setQueryData(getRolesIdPermissionsSuspenseQueryKey(roleId), …)`, calls `resourceCache.changed('roles')` (the signed-in user may hold that role, so `/me/permissions` refetches and the sidebar and guards follow) and notifies; `onError` notifies. Both live on `useMutation` itself. No navigation — the user stays on the page.
- The API rejects grants outside the catalog with 400 and audits every save, so the editor only ever sends what the catalog offers.

**`PermissionsTree`** (`components/permissions-tree.tsx`): pure controlled component — `definitions`, `grants`, `onChange`, `disabled?`. One block per resource with a parent checkbox (checked when all actions are granted, indeterminate when some are) and one checkbox per action the resource declares. Actions come from the catalog, so a new action in `RESOURCE_DEFINITIONS` shows up with no frontend change. Resource labels are translated via `roles:permissions.resources.<resource>`, falling back to the catalog's English `label` for a resource without a key — add one in both locales when you add a resource to `RESOURCE_DEFINITIONS`. Action labels reuse `common:actions.<action>`.

**Requirements** — the catalog's `requires` (API: `PERMISSION_REQUIREMENTS`) says what each permission needs. The tree applies it through `permission-requirements.ts` (pure functions, unit-tested): checking an action (or a whole resource) also checks what it requires, transitively (`grantWithRequirements` — `permissions:edit` → `permissions:view` → `roles:view`); unchecking one also unchecks every held permission that depends on it (`revokeWithDependents`). An action with requirements shows them in a tooltip (`permissions.requires`: "Requires: Permissions › View, Roles › View"). Nothing is hard-coded in the web: a new requirement in the API shows up after `pnpm spec:sync`. Grants saved before a requirement existed load as they are; saving them unchanged answers 400 `missing_required_permissions`, notified through `errors.missing_required_permissions`.

## Sidebar

```ts
{ label: 'nav.roles', icon: IconShield, to: '/roles', access: ROLES_ACCESS.view }
```
