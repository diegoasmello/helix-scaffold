# roles module — frontend

Full CRUD module. Also exports `RoleSelectField`, a cross-module component consumed by the users module and the permissions module.

## File structure

```
src/modules/roles/
├── types.ts
├── validation.ts
├── validation.test.ts
├── components/
│   ├── roles-form.tsx          ← shared form fields (create + edit)
│   └── role-select-field.tsx   ← cross-module Select component
└── routes/
    ├── index.ts
    ├── roles-pending.tsx
    ├── roles-list.tsx
    ├── roles-list.test.tsx
    ├── roles-create.tsx
    ├── roles-detail.tsx
    └── roles-edit.tsx
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

Cross-module component exported for use by other modules. Wraps a `<Select>` backed by `useGetRolesAllSuspense()` (consumes `GET /roles/all`). Props are `Omit<SelectProps, 'data'>` — callers pass `value`, `onChange`, `error`, and any other `Select` props except `data`.

```tsx
import { RoleSelectField } from '../../roles/components/role-select-field'

<RoleSelectField
  value={form.values.roleId}
  onChange={(value) => form.setFieldValue('roleId', value)}
  error={form.errors.roleId}
/>
```

Always `searchable` and `clearable`. Selecting nothing returns `null`. Callers must ensure `getRolesAllSuspenseQueryOptions()` is prefetched in the route loader or the component will suspend on its own.

## Routes (`routes/index.ts`)

| Constant           | Path               | Permission     |
| ------------------ | ------------------ | -------------- |
| `rolesListRoute`   | `/roles`           | `roles:view`   |
| `rolesCreateRoute` | `/roles/create`    | `roles:create` |
| `rolesDetailRoute` | `/roles/$id`       | `roles:view`   |
| `rolesEditRoute`   | `/roles/$id/edit`  | `roles:edit`   |

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

**No `/roles/all` cache invalidation on mutations** — after creating, editing, or deleting a role, the `getRolesAllSuspenseQueryKey()` cache is not invalidated. If stale data in `RoleSelectField` is a concern, add `queryClient.invalidateQueries({ queryKey: getRolesAllSuspenseQueryKey() })` to each mutation's `onSuccess`.

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
