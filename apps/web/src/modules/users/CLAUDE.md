# users module — frontend

Full CRUD module. Differs from other modules in three notable ways: two separate form validators (create vs. edit), the `PasswordInput` field is conditionally rendered via `isEditing`, and action buttons in the list are wrapped with `<HasPermission>`.

## File structure

```
src/modules/users/
├── types.ts
├── validation.ts
├── validation.test.ts
├── components/
│   ├── users-form.tsx               ← shared form fields; hides password when isEditing
│   ├── users-form.test.tsx
│   ├── user-select-field.tsx        ← cross-module Select over GET /users/all ("name (email)")
│   └── user-select-field.test.tsx
└── routes/
    ├── index.ts
    ├── users-pending.tsx
    ├── users-list.tsx
    ├── users-list.test.tsx
    ├── users-create.tsx
    ├── users-create.test.tsx
    ├── users-detail.tsx
    ├── users-detail.test.tsx
    ├── users-edit.tsx
    └── users-edit.test.tsx
```

`UserSelectField` is used by the subscriptions admin form (`userId`). It needs `getUsersAllSuspenseQueryOptions()` prefetched in the route loader, or it suspends on its own.

## Types (`types.ts`)

| Alias             | Source (`@helix/api-client/types`) |
| ----------------- | ---------------------------------- |
| `UserItem`        | `UserWithRole`                     |
| `CreateUserInput` | `PostUsersMutationRequest`         |
| `UpdateUserInput` | `PatchUsersIdMutationRequest`      |

`UserItem` is `UserWithRole` — always has an embedded `role: { id, name } | null`. There is no plain `User` type used in this module.

`UserFormValues` is a form-specific interface:

```ts
interface UserFormValues {
  name: string
  email: string
  roleId: string | null   // null = no role assigned
  password: string        // only used on create; always '' on edit initialValues
}
```

## Validation (`validation.ts`)

Two separate validator objects — one per form context:

- `userCreateFormValidate` — validates `name` (required, max 100), `email` (required, valid format), `password` (required, min 8).
- `userEditFormValidate` — validates only `name` and `email`. **No `password` field** — password change is not supported.

Use `userCreateFormValidate` in `UsersCreate` and `userEditFormValidate` in `UsersEdit`. Using the wrong one will either skip password validation on create or cause a spurious error on edit.

## Form fields (`components/users-form.tsx`)

`UsersFormProps` has `isEditing?: boolean`. When `true`, the `PasswordInput` is not rendered.

| Field      | Component          | Notes                                                                        |
| ---------- | ------------------ | ---------------------------------------------------------------------------- |
| `name`     | `TextInput`        |                                                                              |
| `email`    | `TextInput`        | `type="email"`                                                               |
| `password` | `PasswordInput`    | Rendered only when `!isEditing`                                              |
| `roleId`   | `RoleSelectField`  | Cross-module component from `roles/components/role-select-field.tsx`; `allowCreate` (inline role creation drawer), `{...form.getInputProps('roleId')}` |

`RoleSelectField` calls `useGetRolesAllSuspense()` internally — it consumes `GET /roles/all`. The parent must ensure the roles query is prefetched in the route loader.

## Role selector prefetch

Both `usersCreateRoute` and `usersEditRoute` fire `getRolesAllSuspenseQueryOptions()` in the loader as a fire-and-forget (not awaited / not returned) so `RoleSelectField` renders instantly without a fallback:

```ts
// create loader — fire-and-forget only
loader: () => { queryClient.ensureQueryData(getRolesAllSuspenseQueryOptions()) }

// edit loader — fire-and-forget roles, await user
loader: ({ params }) => {
  queryClient.ensureQueryData(getRolesAllSuspenseQueryOptions())
  return queryClient.ensureQueryData(getUsersIdSuspenseQueryOptions(params.id))
}
```

## Routes (`routes/index.ts`)

| Constant           | Path               | Permission     |
| ------------------ | ------------------ | -------------- |
| `usersListRoute`   | `/users`           | `users:view`   |
| `usersCreateRoute` | `/users/create`    | `users:create` |
| `usersDetailRoute` | `/users/$id`       | `users:view`   |
| `usersEditRoute`   | `/users/$id/edit`  | `users:edit`   |

`usersListRoute` validateSearch: `page` (default 1), `pageSize` (default 10), `sortBy` (enum `name | email | createdAt`, optional), `sortOrder` (default `'desc'`).

## Data fetching

- List: `useGetUsersSuspense({ page, pageSize, sortBy, sortOrder })`
- Detail/Edit: `useGetUsersIdSuspense(id)`
- Role selector: `useGetRolesAllSuspense()` (inside `RoleSelectField` — not called directly)

## Mutations

Inline in each component — no `hooks.ts`.

**Create**: sends `name`, `email`, `password`, and `roleId` only when non-null — `...(values.roleId ? { roleId: values.roleId } : {})`. Invalidates list on success.

**Update**: always sends `roleId` (including `null` to remove the role). Does not send `password`. `resourceCache.saved('users', updated)` — seeds the item cache, refetches the lists (`/users/all` included) and `/me/permissions`.

**Delete** (in `UsersList`): has `onError` on the `useMutation` call itself (not just on `mutate`) — notifies on failure without navigating. Confirm message includes the user's name: `Are you sure you want to delete "${name}"?`. `resourceCache.removed('users', id)` — drops the item cache, refetches the lists (`/users/all` included, the subscriptions form's select).

## RBAC in the list screen

Unlike the todos module, `UsersList` wraps action buttons with `<HasPermission>`:

- Create button → `<HasPermission resource="users" action="create">`
- Edit icon → `<HasPermission resource="users" action="edit">`
- Delete icon → `<HasPermission resource="users" action="delete">`

View icon is always visible.

## Sidebar

```ts
{ label: 'nav.users', icon: IconUsers, to: '/users', access: USERS_ACCESS.view }
```

## Notes

- The list renders `role?.name ?? '—'` for users without a role — no badge, just plain text.
- The detail screen renders `emailVerified` as `'Yes' / 'No'` text.
- `password` must never be sent to the edit endpoint — `UserFormValues.password` is initialised to `''` on edit and deliberately excluded from `UpdateUserInput`.
