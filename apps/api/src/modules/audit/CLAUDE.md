# audit module — backend

Read-only module. Exposes two endpoints (`GET /audit-logs`, `GET /audit-logs/:id`) — no POST, PATCH, or DELETE. Audit entries are written exclusively by the `registerAuditRequest` hook, never via a public endpoint.

## Dual role

The audit module has two responsibilities that are implemented separately:

1. **Writing logs** — `createAuditService(database).log(input)` is called inside `registerAuditRequest` (`src/hooks/audit-request.ts`). This hook runs on `onRequest` in the authenticated scope and attaches `request.audit(action, resource, resourceId?, metadata?)` to every request. Route handlers call this method after a successful mutation.

2. **Reading logs** — `auditRoutes` exposes the list and detail endpoints for the UI to query.

The `auditService` is instantiated once in `app.ts` and passed to both `registerAuditRequest` and `auditRoutes`.

## Data model

**Table**: `audit_logs` (`src/db/schema/audit-logs.ts`)  
**Index**: `audit_logs_created_at_idx` on `createdAt` (speeds up the default sort).

| Column       | DB type              | Notes                                           |
| ------------ | -------------------- | ----------------------------------------------- |
| `id`         | `text` PK            | UUIDv7, generated at insert                     |
| `userId`     | `text NOT NULL`      | Snapshotted at write time — no FK to `user`     |
| `userName`   | `text NOT NULL`      | Snapshotted at write time                       |
| `userEmail`  | `text NOT NULL`      | Snapshotted at write time                       |
| `action`     | `text NOT NULL`      | `'create' | 'edit' | 'delete'`                  |
| `resource`   | `text NOT NULL`      | Resource string (e.g. `'todos'`, `'users'`)     |
| `resourceId` | `text` (nullable)    | Id of the affected record; null when n/a        |
| `metadata`   | `jsonb` (nullable)   | Request body for create/edit; null for delete   |
| `ip`         | `text` (nullable)    | From `request.ip`                               |
| `userAgent`  | `text` (nullable)    | From `request.headers['user-agent']`            |
| `createdAt`  | `timestamp NOT NULL` | `defaultNow()`; **no `updatedAt`** (immutable)  |

User fields (`userId`, `userName`, `userEmail`) are snapshotted at write time — there is **no FK** to the `user` table. This means logs remain accurate even if the user is later renamed or deleted.

## Schema (`audit-schema.ts`)

- `auditLogSchema` — full entity; `.meta({ id: 'AuditLog', title: 'AuditLog' })`.
- No create/update schemas — entries are never written via the API.
- Sort columns: `['createdAt', 'userName', 'action', 'resource']`. Default sort: `createdAt`.

## Service (`audit-service.ts`)

`createAuditService(database)` returns `{ log, list, getById }`:

- `log(input)` — inserts one row. Called by `registerAuditRequest` inside `.catch()` so failures are logged but never propagated.
- `list(query)` — paginated + sorted, same pattern as other modules.
- `getById(id)` — returns `null` when not found.

`AuditLogInput` (internal, not exported) — `{ userId, userName, userEmail, action, resource, resourceId?, metadata?, ip?, userAgent? }`. All optional fields default to `null` in the insert.

## Routes (`audit-routes.ts`)

Receives `{ database, requirePermission }` — no `auth` parameter.

| Method | Path              | Permission    | Audit call |
| ------ | ----------------- | ------------- | ---------- |
| `GET`  | `/audit-logs`     | `audit:view`  | —          |
| `GET`  | `/audit-logs/:id` | `audit:view`  | —          |

No mutation routes. No audit calls within the audit module itself.

## `registerAuditRequest` hook (`src/hooks/audit-request.ts`)

Registered once in the authenticated scope in `app.ts` via `registerAuditRequest(authenticated, createAuditService(database))`. It runs on `onRequest` and attaches `request.audit` to every authenticated request. The implementation:

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

**Integration test** (`describe('Audit logging via onResponse hook')`): makes a real `POST /todos` request via `app.inject` and then queries `auditLogs` directly with `testDb.select()` to assert the entry was created. Also verifies that a failed request (400) does **not** create a log.

**Permission enforcement**: both GET routes require `audit:view`. The permission block tests each with an empty grants session. Email pattern: `restricted-audit-${Date.now()}@test.com`.
