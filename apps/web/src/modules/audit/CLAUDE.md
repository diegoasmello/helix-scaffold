# audit module — frontend

Read-only module. No create, edit, or delete — only list and detail. No form, no validation, no mutations, no `types.ts`.

## File structure

```
src/modules/audit/
├── components/
│   └── audit-action-badge.tsx
└── routes/
    ├── index.ts
    ├── audit-pending.tsx
    ├── audit-list.tsx
    ├── audit-list.test.tsx
    ├── audit-detail.tsx
    └── audit-detail.test.tsx
```

No `types.ts` — the module uses `AuditLog` from `@helix/api-client/types` directly (not aliased). No `validation.ts`, no `hooks.ts`.

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

`PageList` whose `actions` hold only the **Export PDF** button — no Create button. The export uses `useExportPdf('/audit-logs/export', { sortBy, sortOrder }, 'audit-logs')` (sort only; the audit list has no filters). See `apps/web/CLAUDE.md` → _PDF export_.

Columns: `createdAt` (`formatDateTime(parseISO(...))` from `@/utils/date`, sortable), `userName` (sortable), `action` (`AuditActionBadge`, sortable), `resource` (sortable), `resourceId` (`?? '—'`), `ip` (`?? '—'`), `actions` (`RowActions` with View only).

No Edit or Delete buttons. No `<HasPermission>` wrappers — reading the list already requires `audit:view`.

Entries written by the billing webhook have `userId: 'system:<adapter>'` and `userName: 'Billing webhook (<adapter>)'` — they are not real users, so never link `userId` to `/users/$id`.

## Action badge (`components/audit-action-badge.tsx`)

`AuditActionBadge` renders the action in both screens. The label comes from `audit:actionLabels.<action>` (`create`, `edit`, `delete`, `export` in `en` and `pt-BR`); the API types `action` as a plain string, so an unknown action falls back to its raw key. `ACTION_COLORS` maps `create` green, `edit` blue, `delete` red; anything else — including `export` — is `gray`. A new audit action (`AuditAction` in `apps/api/src/modules/audit/audit-recorder.ts`) needs its label in both locale files.

## Detail screen (`audit-detail.tsx`)

`PageView` titled `t('detail.title')` with the fields as `LabeledValue`s in a `Grid` (date, `AuditActionBadge`, user + email, resource, resource id, IP; user agent and metadata full width when present). `createdAt` is shown with `formatDate(parseISO(...), 'short')`.

`userAgent` and `metadata` are conditionally rendered:

- `userAgent` — rendered only when truthy.
- `metadata` — rendered only when `!= null`, as `JSON.stringify(log.metadata, null, 2)` inside `<Text component="pre">`. `useStyles().classes.metadata` sets `white-space: pre-wrap` and `word-break: break-all` so long values wrap.

## Sidebar

```ts
{ label: 'nav.auditLog', icon: IconClipboardList, to: '/audit', access: AUDIT_ACCESS.view }
```
