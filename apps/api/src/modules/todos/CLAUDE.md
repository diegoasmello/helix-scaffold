# todos module — backend

Full CRUD module. Reference implementation for `apps/api` — the workspace `CLAUDE.md` uses this module as the canonical example.

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

| Method | Path            | Permission     | Audit call                                                              |
| ------ | --------------- | -------------- | ----------------------------------------------------------------------- |
| `GET`  | `/todos/export` | `todos:view`   | `request.audit('export', 'todos', undefined, { sortBy, sortOrder, filterLogic, filterCount })` |
| `GET`  | `/todos`        | `todos:view`   | —                                                                       |
| `GET`  | `/todos/:id`    | `todos:view`   | —                                                                       |
| `POST` | `/todos`        | `todos:create` | `request.audit('create', 'todos', id, body)`                            |
| `PATCH`  | `/todos/:id`  | `todos:edit`   | `request.audit('edit', 'todos', id, body)`                              |
| `DELETE` | `/todos/:id`  | `todos:delete` | `request.audit('delete', 'todos', id)`                                  |

`GET /todos/export` must be registered **before** `GET /todos` — Fastify matches routes in registration order and `/todos/export` would otherwise be captured by `/todos/:id`.

`DELETE` returns `204` even when the id does not exist (Drizzle `delete().where()` is a no-op on missing rows).

## PDF template (`src/modules/todos/templates/todos-report.tsx`)

Renders a single-page table with columns: Title, Status, Date. Uses `BaseDocument` from `src/lib/pdf/` for the shared page shell. Exported function:

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
