# permissions module — frontend

Single-screen module. No list/create/edit/detail split — one page with a role selector and an inline editor. No `types.ts`, no `validation.ts`, no `hooks.ts`.

## File structure

```
src/modules/permissions/
├── components/
│   ├── permissions-editor.tsx   ← fetches + saves grants for a selected role
│   └── permissions-tree.tsx     ← pure controlled checkbox UI
└── routes/
    ├── index.ts
    ├── permissions-pending.tsx
    └── permissions.tsx          ← role selector + editor mount point
```

## Route (`routes/index.ts`)

Single route, not exported as a named constant — assigned to a local `const permissionsRoute` and collected in `permissionsRoutes = [permissionsRoute]`.

| Path | Permission |
| --- | --- |
| `/permissions` | `permissions:view` |

The loader fire-and-forgets `getPermissionsResourcesSuspenseQueryOptions()` (resource catalog) and awaits `getRolesSuspenseQueryOptions()` (role list for the selector). The roles list is returned so breadcrumbs can resolve; the resources are prefetched so `PermissionsEditor` renders instantly.

Note: the loader uses `getRolesSuspenseQueryOptions()` (paginated list) to prefetch for the route, but the `Permissions` component calls `useGetRolesAllSuspense()` (unpaginated `/roles/all`) at render time. These are different queries with different cache keys.

## `Permissions` screen (`routes/permissions.tsx`)

Role selector in the `actions` slot of `PageList` — a `<Select>` driven by `useGetRolesAllSuspense()`. Selected role id is held in `useState<string | null>`.

When no role is selected: renders a centered empty-state message.

When a role is selected: renders `<PermissionsEditor roleId={selectedRoleId} />` inside a local `<Suspense>` fallback (the editor fetches its own data). The `key={selectedRoleId}` prop resets the editor state entirely when the role changes — this is intentional, discarding any unsaved edits.

## `PermissionsEditor` (`components/permissions-editor.tsx`)

Receives `roleId: string`. Fetches two independent data sources on mount:

- `useGetRolesIdPermissionsSuspense(roleId)` — the current grants for the role (`GET /roles/:id/permissions`).
- `useGetPermissionsResourcesSuspense()` — the static resource/action catalog (`GET /permissions/resources`).

Local state `grants: Grants` (initialised from `saved.grants`) holds the in-progress edits. Changes flow down through `PermissionsTree.onChange` — never committed until the user clicks Save.

**Save mutation** — calls `putRolesIdPermissions(roleId, { grants })` (a `PUT`, full replacement). On success: updates the cache directly with `setQueryData` (no list invalidation needed — this query is keyed by `roleId`) and notifies. On error: notifies with danger.

The mutation uses `onSuccess`/`onError` on the `useMutation` call itself (not on the `mutate()` call) — both notify immediately without waiting for component mount state.

No navigation on save — the user stays on the same page to continue editing other roles.

## `PermissionsTree` (`components/permissions-tree.tsx`)

Pure controlled component — receives `definitions`, `grants`, `onChange`. No internal state, no hooks.

Each resource renders as a `<Paper>` with:
- A **parent checkbox** (`checked` when all actions are granted, `indeterminate` when some are granted). Toggling it sets all actions to granted or clears them all.
- **Child checkboxes** — one per action in `def.actions`. `ACTION_LABELS` maps `PermissionAction` → display string.

`ACTION_LABELS`:

```ts
{ view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete' }
```

Actions available per resource are driven by `definitions` from the API catalog — the component renders whatever actions the server declares. Adding a new action to `RESOURCE_DEFINITIONS` on the backend is reflected here automatically with no frontend change.

## Data flow summary

```
Permissions (role selector)
  └── PermissionsEditor (key=roleId — resets on role change)
        ├── useGetRolesIdPermissionsSuspense(roleId)  →  saved.grants
        ├── useGetPermissionsResourcesSuspense()       →  definitions
        ├── useState(saved.grants)                     →  local grants (editable)
        └── PermissionsTree (definitions, grants, onChange)
```

## Sidebar

```ts
{ label: 'Permissions', icon: IconLock, to: '/permissions', permission: { resource: 'permissions', action: 'view' } }
```
