# audit module — frontend

Read-only module. No create, edit, or delete — only list and detail. No form, no validation, no mutations, no `types.ts`, no `components/` directory.

## File structure

```
src/modules/audit/
└── routes/
    ├── index.ts
    ├── audit-pending.tsx
    ├── audit-list.tsx
    ├── audit-list.test.tsx
    ├── audit-detail.tsx
    └── audit-detail.test.tsx
```

No `types.ts` — the module uses `AuditLog` from `@helix/api-client/types` directly (not aliased). No `validation.ts`, no `hooks.ts`, no `components/`.

## Types

`AuditLog` is imported directly from `@helix/api-client/types` — no local alias in a `types.ts` file. This is the exception to the pattern used by other modules.

## Routes (`routes/index.ts`)

| Constant          | Path          | Permission   |
| ----------------- | ------------- | ------------ |
| `auditListRoute`  | `/audit`      | `audit:view` |
| `auditDetailRoute`| `/audit/$id`  | `audit:view` |

No create or edit routes — the resource is immutable from the UI's perspective.

`auditListRoute` validateSearch: `page` (default 1), `pageSize` (default 10), `sortBy` (enum `createdAt | userName | action | resource`, optional), `sortOrder` (default `'desc'`).

Both routes require `audit:view`. There is no `audit:create`, `audit:edit`, or `audit:delete` permission.

## Data fetching

- List: `useGetAuditLogsSuspense({ page, pageSize, sortBy, sortOrder })`
- Detail: `useGetAuditLogsIdSuspense(id)`
- Loaders: `getAuditLogsSuspenseQueryOptions(deps)` and `getAuditLogsIdSuspenseQueryOptions(id)`

No mutations, no cache invalidation, no `useQueryClient`.

## List screen (`audit-list.tsx`)

`PageList` with no `actions` prop — there is no Create button.

`ACTION_COLORS` maps action strings to badge colors:

```ts
const ACTION_COLORS: Record<string, string> = {
  create: 'green',
  edit: 'blue',
  delete: 'red',
}
```

`formatDate(iso: string)` converts the ISO timestamp via `new Date(iso).toLocaleString()` — used in the list and detail screens.

Columns: `createdAt` (formatted, sortable), `userName` (sortable), `action` (Badge, sortable), `resource` (sortable), `resourceId` (nullable — `?? '—'`), `ip` (nullable — `?? '—'`), `actions` (View icon only, width 80).

No Edit or Delete icons. No `<HasPermission>` wrappers — reading the list already requires `audit:view`.

## Detail screen (`audit-detail.tsx`)

`PageView` title is `"${log.resource} — ${log.action}"` (not the entity id).

`ACTION_COLORS` is typed as `Record<AuditLog['action'], string>` (not `Record<string, string>` as in the list) — tighter typing.

`userAgent` and `metadata` are conditionally rendered — they are skipped when `null` or `undefined`:

- `userAgent` — rendered only when truthy.
- `metadata` — rendered only when `!= null`; displayed as formatted JSON via `JSON.stringify(log.metadata, null, 2)` inside a `<Text component="pre">` with `whiteSpace: 'pre-wrap'`.

## Sidebar

```ts
{ label: 'Audit Log', icon: IconClipboardList, to: '/audit', permission: { resource: 'audit', action: 'view' } }
```
