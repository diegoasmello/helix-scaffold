# roles module — frontend

Full CRUD module. Also exports two cross-module components consumed by other modules: `RoleSelectField` and `RoleCreateDrawer`.

## File structure

```
src/modules/roles/
├── types.ts
├── validation.ts
├── validation.test.ts
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

| Field         | Component  | Notes              |
| ------------- | ---------- | ------------------ |
| `name`        | `TextInput`| `getInputProps`    |
| `description` | `Textarea` | `resize="vertical"`|

No `isEditing` prop — the form is identical for create and edit.

## `RoleSelectField` (`components/role-select-field.tsx`)

Cross-module component exported for use by other modules. Wraps a `<Select>` backed by `useGetRolesAllSuspense()` (consumes `GET /roles/all`). Props are `Omit<SelectProps, 'data'> & { allowCreate?: boolean }`.

Always `searchable` and `clearable`. Selecting nothing returns `null`. Callers must ensure `getRolesAllSuspenseQueryOptions()` is prefetched in the route loader or the component will suspend on its own.

**Basic usage:**

```tsx
<RoleSelectField
  value={form.values.roleId}
  onChange={(value) => form.setFieldValue('roleId', value)}
  error={form.errors.roleId}
/>
```

**With inline creation** (`allowCreate`): renders the select followed by a "Create related role" button below it. Clicking the button opens `RoleCreateDrawer`. On successful creation the new role is automatically selected.

```tsx
<RoleSelectField
  allowCreate
  value={form.values.roleId}
  onChange={(value) => form.setFieldValue('roleId', value)}
  error={form.errors.roleId}
/>
```

## `RoleCreateDrawer` (`components/role-create-drawer.tsx`)

Cross-module drawer that renders a full role creation form (`RolesForm`) inside a Mantine `Drawer`. Used internally by `RoleSelectField` when `allowCreate` is true — consuming modules do not import it directly.

Props: `opened`, `onClose`, `onSuccess(roleId)`. On success: invalidates `getRolesAllSuspenseQueryKey()` so `RoleSelectField` refreshes, then calls `onSuccess` with the created role's ID.

## Routes (`routes/index.ts`)

| Constant           | Path               | Permission     |
| ------------------ | ------------------ | -------------- |
| `rolesListRoute`   | `/roles`           | `roles:view`   |
| `rolesCreateRoute` | `/roles/create`    | `roles:create` |
| `rolesDetailRoute` | `/roles/$id`       | `roles:view`   |
| `rolesEditRoute`   | `/roles/$id/edit`  | `roles:edit`   |
| `rolesPermissionsRoute` | `/roles/$id/permissions` | `permissions:edit` |

`rolesListRoute` validateSearch: `page` (default 1), `pageSize` (default 10), `sortBy` (enum `name | createdAt`, optional), `sortOrder` (default `'desc'`).

No `/roles/all` route — `GET /roles/all` is only consumed internally by `RoleSelectField`.

## Data fetching

- List: `useGetRolesSuspense({ page, pageSize, sortBy, sortOrder })`
- Detail/Edit: `useGetRolesIdSuspense(id)`
- Role select (in `RoleSelectField`): `useGetRolesAllSuspense()` — different query key from the paginated list

## Mutations

Inline in each component — no `hooks.ts`.

**Create**: invalidates list (`getRolesSuspenseQueryKey()`, `exact: true`).  
**Update**: invalidates list + `setQueryData` on item cache.  
**Delete** (in `RolesList`): `onError` on `useMutation` itself (not on `mutate`) — notifies on failure. Confirm message includes the role's name: `Are you sure you want to delete "${name}"?`. Invalidates list + `removeQueries` on item cache.

**`/roles/all` cache invalidation** — the standard CRUD mutations (create/edit/delete in the routes) do not invalidate `getRolesAllSuspenseQueryKey()`. Only `RoleCreateDrawer` invalidates it, because that is the one creation path that must immediately refresh the select options.

## RBAC in the list screen

`RolesList` wraps action buttons with `<HasPermission>`:

- Create button → `<HasPermission resource="roles" action="create">`
- Edit icon → `<HasPermission resource="roles" action="edit">`
- Delete icon → `<HasPermission resource="roles" action="delete">`

View icon is always visible.

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

## Sidebar

```ts
{ label: 'Roles', icon: IconShield, to: '/roles', permission: { resource: 'roles', action: 'view' } }
```
