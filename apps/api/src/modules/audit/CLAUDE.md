# audit module — backend

Read-only module. Exposes three endpoints (`GET /audit-logs`, `GET /audit-logs/:id`, `GET /audit-logs/export`) — no POST, PATCH, or DELETE. Entries are never written through a public endpoint: route handlers write them via `request.audit()` (the `registerAuditRequest` hook), and the billing webhook writes system entries by calling `auditService.log()` directly.

## Dual role

The audit module has two responsibilities that are implemented separately:

1. **Writing logs** — `auditService.log(input)`:
   - from `registerAuditRequest` (`src/hooks/audit-request.ts`), which runs on `onRequest` in the authenticated scope and attaches `request.audit(action, resource, resourceId?, metadata?)`. Route handlers call it after a successful mutation;
   - from `billingWebhookRoutes` (public scope, no session), with a system actor: `userId: 'system:<adapter>'`, `userName: 'Billing webhook (<adapter>)'`, `userEmail: 'system'`.

2. **Reading logs** — `auditRoutes` exposes the list, detail and export endpoints.

`app.ts` creates one `auditService` and passes it to `registerAuditRequest` and `billingWebhookRoutes`. `auditRoutes` builds its own instance from `database`.

## Data model

**Table**: `audit_logs` (`src/db/schema/audit-logs.ts`)  
**Index**: `audit_logs_created_at_idx` on `createdAt` (speeds up the default sort).

| Column       | DB type              | Notes                                           |
| ------------ | -------------------- | ----------------------------------------------- |
| `id`         | `text` PK            | UUIDv7, generated at insert                     |
| `userId`     | `text NOT NULL`      | Snapshotted at write time — no FK to `user`; `system:<adapter>` for webhook entries |
| `userName`   | `text NOT NULL`      | Snapshotted at write time                       |
| `userEmail`  | `text NOT NULL`      | Snapshotted at write time                       |
| `action`     | `text NOT NULL`      | `'create' \| 'edit' \| 'delete' \| 'export'`      |
| `resource`   | `text NOT NULL`      | Resource string (e.g. `'todos'`, `'users'`)     |
| `resourceId` | `text` (nullable)    | Id of the affected record; null when n/a        |
| `metadata`   | `jsonb` (nullable)   | Request body for create/edit; null for delete; export params summary for export |
| `ip`         | `text` (nullable)    | From `request.ip`                               |
| `userAgent`  | `text` (nullable)    | From `request.headers['user-agent']`            |
| `createdAt`  | `timestamp NOT NULL` | `defaultNow()`; **no `updatedAt`** (immutable)  |

User fields (`userId`, `userName`, `userEmail`) are snapshotted at write time — there is **no FK** to the `user` table. This means logs remain accurate even if the user is later renamed or deleted.

## Schema (`audit-schema.ts`)

- `auditLogSchema` — full entity; `.meta({ id: 'AuditLog', title: 'AuditLog' })`.
- No create/update schemas — entries are never written via the API.
- Sort columns: `['createdAt', 'userName', 'action', 'resource']`. Default sort: `createdAt`.
- `auditLogsExportQuerySchema` — sorting only (no pagination, no filters): `auditLogsSortingSchema`. Used by `GET /audit-logs/export`.

## Service (`audit-service.ts`)

`createAuditService(database)` returns `{ log, list, getById, generateReport }`:

- `log(input)` — inserts one row. Called by `registerAuditRequest` inside `.catch()` so failures are logged but never propagated.
- `list(query)` — paginated + sorted, same pattern as other modules.
- `getById(id)` — returns `null` when not found.
- `generateReport(query)` — queries up to 5000 rows respecting sort order, delegates to `renderAuditReport` via dynamic import.

`AuditLogInput` (internal, not exported) — `{ userId, userName, userEmail, action, resource, resourceId?, metadata?, ip?, userAgent? }`. All optional fields default to `null` in the insert.

## Routes (`audit-routes.ts`)

Receives `{ database, requirePermission }` — no `auth` parameter.

| Method | Path                    | Permission   | Audit call |
| ------ | ----------------------- | ------------ | ---------- |
| `GET`  | `/audit-logs/export`    | `audit:view` | — (no audit calls within the audit module itself) |
| `GET`  | `/audit-logs`           | `audit:view` | —          |
| `GET`  | `/audit-logs/:id`       | `audit:view` | —          |

No mutation routes. No audit calls within the audit module itself — including the export endpoint.

`GET /audit-logs/export` does not clash with `GET /audit-logs/:id` — Fastify's router always prefers the static segment, whatever the registration order.

## `registerAuditRequest` hook (`src/hooks/audit-request.ts`)

Registered once in the authenticated scope in `app.ts` via `registerAuditRequest(authenticated, auditService)`. It runs on `onRequest` and attaches `request.audit` to every authenticated request. The implementation:

1. Reads `request.sessionUser` (id, name, email), `request.ip`, and `request.headers['user-agent']`.
2. Calls `auditService.log(...)`.
3. Wraps the call in `.catch((err) => request.log.error(...))` — failures are **never** re-thrown. The audit log is best-effort and must not affect the HTTP response.

## Permissions config

```ts
{ resource: 'audit', label: 'Audit Log', actions: ['view'] }
```

Only `view` is registered — there is no create/edit/delete permission.

## Tests (`audit-routes.test.ts`)

`cleanupAuditLogs()` truncates the `audit_logs` table between tests.

**Seeding logs directly**: `testDb.insert(auditLogs).values({ userId, userName, userEmail, action, resource, ... })`. Unlike the `user` table, `userId` is a plain text field with no FK — any string value is valid.

**Default sort test**: seeds two logs with explicit `createdAt` timestamps and asserts order without `sortBy` (defaults to `createdAt asc`).

**Integration test** (`describe('Audit logging via onResponse hook')` — the name is historical; the hook runs on `onRequest`): makes a real `POST /todos` request via `app.inject` and then queries `auditLogs` directly with `testDb.select()` to assert the entry was created. Also verifies that a failed request (400) does **not** create a log.

**Export tests** (`describe('GET /audit-logs/export')`): asserts 200 + `content-type: application/pdf` + `content-disposition` header with the expected filename pattern. A second test seeds logs and verifies the endpoint accepts `sortBy`/`sortOrder` params.

**Permission enforcement**: all three GET routes require `audit:view`. The permission block tests each with an empty grants session. Email pattern: `restricted-audit-${Date.now()}@test.com`.
