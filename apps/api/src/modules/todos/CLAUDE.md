# todos module — backend

Full CRUD module. Reference implementation for `apps/api` — the workspace `CLAUDE.md` uses this module as the canonical example.

This module also serves as the **reference implementation for `requireSubscription`**. All todos routes require both an RBAC permission and an active subscription. When building a product on this scaffold, follow this module's route registration pattern for any feature that should be gated behind a subscription.

## Data model

**Table**: `todos` (`src/db/schema/todos.ts`)  
**Postgres enum**: `todo_status` — `'pending' | 'completed'`

| Column        | DB type                | Notes                           |
| ------------- | ---------------------- | ------------------------------- |
| `id`          | `text` PK              | UUIDv7, generated at insert     |
| `title`       | `text NOT NULL`        |                                 |
| `description` | `text NOT NULL`        |                                 |
| `content`     | `text NOT NULL`        | Rich text (HTML string)         |
| `status`      | `todo_status NOT NULL` | Default `'pending'` at DB level |
| `date`        | `timestamp NOT NULL`   | User-supplied date, no timezone |
| `createdAt`   | `timestamp NOT NULL`   | `defaultNow()`                  |
| `updatedAt`   | `timestamp NOT NULL`   | `$onUpdateFn(() => new Date())` |

## Schema (`todos-schema.ts`)

- `todoSchema` — full entity returned by the API; registered with `.meta({ id: 'Todo', title: 'Todo' })` so swagger emits it as a named `$ref`
- `createTodoSchema` — `{ title, description, content, date }`. **No `status` field** — status defaults to `'pending'` via the DB column default and is not accepted on create.
- `updateTodoSchema` — all fields optional: `title`, `description`, `content`, `status`, `date`. This is the only way to change status.
- `todosExportQuerySchema` — sorting + filtering only (no pagination): `todosSortingSchema.merge(todosFilterQuerySchema)`. Used by `GET /todos/export`.
- `date` uses `z.coerce.date()` in both create and update schemas so ISO strings from the request body are coerced to `Date`.
- Sort columns: `['title', 'status', 'date', 'createdAt']`. Default sort: `createdAt`.

## Service (`todos-service.ts`)

Pure SQL, no business logic. Factory `createTodosService(database)` returns `{ list, getById, create, update, remove, generateReport }`.

- `list` applies both pagination and ordering; `SORT_COLUMNS` maps string names to Drizzle column refs.
- `create` does not set `status` — the DB default takes over.
- `remove` is a hard delete (no soft delete).
- `generateReport` queries up to 5000 rows (hard limit) respecting the same sort/filter params as `list`, then delegates to `renderTodosReport` via dynamic import.

## Routes (`todos-routes.ts`)

All routes require **both** an active subscription (via `requireSubscription()`) **and** an RBAC permission. The `preHandler` arrays follow this order — subscription check first, then permission:

```ts
preHandler: [requireSubscription(), requirePermission('todos', 'view')]
```

| Method | Path | `preHandler` | Audit call |
| --- | --- | --- | --- |
| `GET` | `/todos/export` | `[requireSubscription(), requirePermission('todos', 'view')]` | `request.audit('export', ...)` |
| `GET` | `/todos` | `[requireSubscription(), requirePermission('todos', 'view')]` | — |
| `GET` | `/todos/:id` | `[requireSubscription(), requirePermission('todos', 'view')]` | — |
| `POST` | `/todos` | `[requireSubscription(), requirePermission('todos', 'create')]` | `request.audit('create', 'todos', id, body)` |
| `PATCH` | `/todos/:id` | `[requireSubscription(), requirePermission('todos', 'edit')]` | `request.audit('edit', 'todos', id, body)` |
| `DELETE` | `/todos/:id` | `[requireSubscription(), requirePermission('todos', 'delete')]` | `request.audit('delete', 'todos', id)` |

`GET /todos/export` must be registered **before** `GET /todos` — Fastify matches routes in registration order and `/todos/export` would otherwise be captured by `/todos/:id`.

### Route options signature

`todosRoutes` receives `requireSubscription` alongside `requirePermission`:

```ts
{ database, requirePermission, requireSubscription, storage }
```

When registering a new module that uses `requireSubscription`, mirror this pattern in `app.ts` and in the route module's options type.

### Behavior with `SUBSCRIPTION_MODE=disabled`

When subscription mode is disabled, `requireSubscription()` returns a no-op preHandler. Todos routes work exactly as before — the `[requireSubscription(), requirePermission(...)]` array simply runs the permission check only. No code changes are needed to toggle this behavior.

`DELETE` returns `204` even when the id does not exist (Drizzle `delete().where()` is a no-op on missing rows).

## PDF template (`src/modules/todos/templates/todos-report.tsx`)

Renders a single-page table with columns: Title, Status, Date. Uses `BaseDocument` for the page shell and `PdfTable` for the table rows — both from `src/lib/pdf/`. Column styles are declared via `StyleSheet.create`; the shared table chrome (header style, row style, font sizes) lives in `PdfTable`. Exported function:

```ts
export async function renderTodosReport(items: TodoRow[]): Promise<Buffer>
```

See `src/lib/pdf/CLAUDE.md` for the full template authoring guide.

## Permissions config

Resource registered in `src/config/permissions.ts`:

```ts
{ resource: 'todos', label: 'Todos', actions: ['view', 'create', 'edit', 'delete'] }
```

## Tests (`todos-routes.test.ts`)

Route integration tests against the real `api_test` database.

- `cleanupTodos()` truncates the `todos` table between tests.
- The top-level 401 test hits `GET /todos` without a cookie.
- Permission enforcement block uses `createRestrictedSession` with email pattern `restricted-todos-${Date.now()}@test.com`.
- `POST /todos` test sends `date` as an ISO string (`'2025-03-20'`) — `z.coerce.date()` parses it.
- `PATCH` test asserts that fields not sent in the body (`description`) remain unchanged.
- `DELETE` asserts 204 both for existing and non-existing ids.

**Subscription in tests:** `createTestSession()` in `src/test/helpers.ts` automatically creates an active subscription for the test admin user when `SUBSCRIPTION_MODE=enabled` (which is the case in `.env.test`). Individual todos tests never need to set up a subscription manually — it is always present for the test admin. Restricted-session users created with `createRoleWithPermissions` do not receive a subscription, so they return 403 from subscription-gated routes even if given the `todos:view` permission — this is expected and not tested here (it is tested in `subscriptions-routes.test.ts`).
