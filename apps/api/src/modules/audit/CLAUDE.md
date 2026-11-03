# audit module — backend

Read-only HTTP module. Exposes three endpoints (`GET /audit-logs`, `GET /audit-logs/:id`, `GET /audit-logs/export`) — no POST, PATCH, or DELETE. Entries are never written through a public endpoint: they are written by the **audit recorder** (`audit-recorder.ts`), the only writer.

## Audit recorder (`audit-recorder.ts`)

`createAuditRecorder(auditService, logger)` returns `{ record(actor, entry) }` — **best-effort**: a failed write is logged (`'audit log failed'`, with `action` and `resource`) and never thrown, so auditing can never fail the action it records.

```ts
type AuditActor =
  | { kind: 'user'; id; name; email; ip?; userAgent? }      // a signed-in user
  | { kind: 'system'; id; name; ip?; userAgent? }           // stored as userId 'system:<id>', userEmail 'system'

interface AuditEntry { action: AuditAction; resource: AuditResource; resourceId?; metadata? }
```

- `AuditAction` — `'create' | 'edit' | 'delete' | 'export'`. `AuditResource` — a resource of `RESOURCE_DEFINITIONS` (`src/config/permissions.ts`) or `'me'`.
- `systemActor(id, name, origin?)` builds a system actor. Current system actors:

| Actor (`userId`) | Name | Writes |
| --- | --- | --- |
| `system:<adapter>` | `Billing webhook (<adapter>)` | `create`/`edit` `subscriptions` per synced state (`billing-webhook-routes.ts`) |
| `system:subscription-expiration` | `Subscription expiration` | `edit` `subscriptions` per expired row (`subscriptions/subscription-expiration.ts`) |
| `system:bootstrap` | `Bootstrap` | `create` `users` for the first admin (`bootstrap-routes.ts`) |

`app.ts` creates one recorder (`audit`) over `createAuditService(database)` with `app.log`, and hands it to `registerAuditRequest`, `bootstrapRoutes` and `billingWebhookRoutes`. `server.ts` builds its own for the expiration job.

**Who records what:** the caller decides when — after the action succeeded, and only when something changed (a DELETE of an unknown id writes nothing). The recorder decides how: actor identity, nulls, best-effort. Self-registration (sign-ups and their trials) is not audited.

Unit tests: `audit-recorder.test.ts` (user actor, system actor mapping, failure logged and swallowed).

## Dual role

1. **Writing logs** — the recorder, reached through `request.audit()` (route handlers, after a successful mutation) or `audit.record(systemActor(...), entry)` (no signed-in user).
2. **Reading logs** — `auditRoutes` exposes the list, detail and export endpoints. It builds its own `auditService` from `database`.

## Data model

**Table**: `audit_logs` (`src/db/schema/audit-logs.ts`)  
**Index**: `audit_logs_created_at_idx` on `createdAt` (speeds up the default sort).

| Column       | DB type              | Notes                                           |
| ------------ | -------------------- | ----------------------------------------------- |
| `id`         | `text` PK            | UUIDv7, generated at insert                     |
| `userId`     | `text NOT NULL`      | Snapshotted at write time — no FK to `user`; `system:<id>` for system actors (see _Audit recorder_) |
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

- `log(input)` — inserts one row. Only the audit recorder calls it (it adds the best-effort `.catch()`).
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

Registered once in the authenticated scope in `app.ts` via `registerAuditRequest(authenticated, audit)`. On `onRequest` it attaches `request.audit(action, resource, resourceId?, metadata?)`: `audit.record()` with the session user (id, name, email), `request.ip` and the `user-agent` header as actor. Never throws — see _Audit recorder_. Tested in `src/hooks/audit-request.test.ts`.

## Permissions config

```ts
{ resource: 'audit', label: 'Audit', actions: ['view'] }
```

Only `view` is registered — there is no create/edit/delete permission.

## Tests (`audit-routes.test.ts`)

`cleanupAuditLogs()` truncates the `audit_logs` table between tests.

**Seeding logs directly**: `testDb.insert(auditLogs).values({ userId, userName, userEmail, action, resource, ... })`. Unlike the `user` table, `userId` is a plain text field with no FK — any string value is valid.

**Default sort test**: seeds two logs with explicit `createdAt` timestamps and asserts order without `sortBy` (defaults to `createdAt asc`).

**Integration test** (`describe('Audit logging via onResponse hook')` — the name is historical; the hook runs on `onRequest`): makes a real `POST /todos` request via `app.inject` and then queries `auditLogs` directly with `testDb.select()` to assert the entry was created. Also verifies that a failed request (400) does **not** create a log.

**Export tests** (`describe('GET /audit-logs/export')`): asserts 200 + `content-type: application/pdf` + `content-disposition` header with the expected filename pattern. A second test seeds logs and verifies the endpoint accepts `sortBy`/`sortOrder` params.

**Permission enforcement**: all three GET routes require `audit:view`. The permission block tests each with an empty grants session. Email pattern: `restricted-audit-${Date.now()}@test.com`.
