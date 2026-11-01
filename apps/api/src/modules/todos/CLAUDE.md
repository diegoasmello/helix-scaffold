# todos module — backend

Full CRUD module. Reference implementation for `apps/api` — the workspace `CLAUDE.md` uses this module as the canonical example for pagination, sorting, filtering, PDF export and file attachments (multi-file junction table **and** single-file FK columns).

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
| `fileId`      | `text` (nullable)      | FK → `uploads.id`, `ON DELETE SET NULL` — single PDF |
| `imageId`     | `text` (nullable)      | FK → `uploads.id`, `ON DELETE SET NULL` — single image |
| `createdAt`   | `timestamp NOT NULL`   | `defaultNow()`                  |
| `updatedAt`   | `timestamp NOT NULL`   | `$onUpdateFn(() => new Date())` |

**Junction table**: `todo_attachments` (`src/db/schema/todo-attachments.ts`) — `(todo_id, upload_id)` composite PK, both FKs `ON DELETE CASCADE`. Holds the multi-file `attachments`.

All three upload references (`todo_attachments.upload_id`, `todos.file_id`, `todos.image_id`) are registered in `src/config/upload-references.ts`, so the orphan cleanup job never deletes them.

## Schema (`todos-schema.ts`)

- `todoSchema` — full entity returned by the API, with the uploads embedded: `attachments: Upload[]`, `file: Upload | null`, `image: Upload | null`. Registered with `.meta({ id: 'Todo', title: 'Todo' })` so swagger emits it as a named `$ref`
- `createTodoSchema` — `{ title, description, content, date, attachmentIds (min 1), fileId, imageId }`. All required. **No `status` field** — status defaults to `'pending'` via the DB column default and is not accepted on create.
- `updateTodoSchema` — all fields optional: `title`, `description`, `content`, `status`, `date`, `attachmentIds` (min 1 when sent), `fileId`, `imageId`. This is the only way to change status.
- `todosExportQuerySchema` — sorting + filtering only (no pagination): `todosSortingSchema.merge(todosFilterQuerySchema)`. Used by `GET /todos/export`.
- `date` uses `z.coerce.date()` in both create and update schemas so ISO strings from the request body are coerced to `Date`.
- Sort columns: `['title', 'status', 'date', 'createdAt']`. Default sort: `createdAt`.
- Filter fields: `['title', 'description', 'status', 'date']`.

## Service (`todos-service.ts`)

Factory `createTodosService(database, storage)` returns `{ list, getById, create, update, remove, generateReport }`. Not pure SQL — it also assembles the embedded uploads and cleans up storage, but that logic is covered by the route tests (`describe('Attachments')`), so there is no separate service test.

- `list` applies filters (`FILTER_COLUMNS` + `FILTER_COERCE` for `date`), ordering (`SORT_COLUMNS`) and pagination, then loads attachments (one query for the page, via `todo_attachments`) and the single `file`/`image` uploads (one `inArray` query).
- `create` inserts the row (no `status` — the DB default applies), then inserts one `todo_attachments` row per `attachmentId`.
- `update` updates only the sent columns; when `attachmentIds` is sent it fully resyncs the junction rows (delete all, insert new). Returns `null` for an unknown id.
- `remove` is a hard delete: collects the todo's attachment, file and image uploads → deletes the todo (cascades the junction rows) → deletes those `uploads` rows → deletes their storage keys, original + variants (best-effort, `Promise.allSettled`).
- `generateReport` queries up to 5000 rows (hard limit) with the same sort/filter params as `list`, then delegates to `renderTodosReport` via dynamic import.

## Routes (`todos-routes.ts`)

All routes require **both** an active subscription whose plan includes the `todos` feature (via `requireSubscription('todos')`) **and** an RBAC permission. The `preHandler` arrays follow this order — subscription check first, then permission:

```ts
preHandler: [requireSubscription('todos'), requirePermission('todos', 'view')]
```

| Method | Path | `preHandler` | Audit call |
| --- | --- | --- | --- |
| `GET` | `/todos/export` | `[requireSubscription('todos'), requirePermission('todos', 'view')]` | `request.audit('export', ...)` |
| `GET` | `/todos` | `[requireSubscription('todos'), requirePermission('todos', 'view')]` | — |
| `GET` | `/todos/:id` | `[requireSubscription('todos'), requirePermission('todos', 'view')]` | — |
| `POST` | `/todos` | `[requireSubscription('todos'), requirePermission('todos', 'create')]` | `request.audit('create', 'todos', id, body)` |
| `PATCH` | `/todos/:id` | `[requireSubscription('todos'), requirePermission('todos', 'edit')]` | `request.audit('edit', 'todos', id, body)` |
| `DELETE` | `/todos/:id` | `[requireSubscription('todos'), requirePermission('todos', 'delete')]` | `request.audit('delete', 'todos', id)` |

`GET /todos/export` does not clash with `GET /todos/:id`: Fastify's router (find-my-way) always prefers a static segment over a parametric one, whatever the registration order.

### Route options signature

`todosRoutes` receives `requireSubscription` alongside `requirePermission`:

```ts
{ database, requirePermission, requireSubscription, storage }
```

When registering a new module that uses `requireSubscription`, mirror this pattern in `app.ts` and in the route module's options type.

### Behavior with `subscriptions.enabled: false`

When subscription mode is disabled, `requireSubscription('todos')` returns a no-op preHandler. Todos routes work exactly as before — the `[requireSubscription('todos'), requirePermission(...)]` array simply runs the permission check only. No code changes are needed to toggle this behavior.

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

Route integration tests against the real test database (`helix_test`).

- `beforeEach` runs `cleanupTodos()` and `cleanupUploads()`.
- The top-level 401 test hits `GET /todos` without a cookie.
- `POST /todos` sends `date` as an ISO string (`'2025-03-20'`) — `z.coerce.date()` parses it — plus real upload ids from the local `insertUpload()` helper (a `testDb.insert(uploads)` row — reuse it when a test needs uploads).
- `PATCH` asserts that fields not sent in the body (`description`) remain unchanged.
- `DELETE` asserts 204 both for existing and non-existing ids.
- `describe('Filtering')` is the reference for filter tests (see `apps/api/CLAUDE.md` → _Filtering_).
- `describe('Attachments')` covers create/read/update of `attachmentIds` and that deleting a todo removes its attachment rows.

**Subscription in tests:** `createTestSession()` creates an active `pro` subscription for the test admin (subscriptions are always enabled in tests via `src/config/test-overrides.ts`), so individual tests never set one up.

**Caveat — the permission block does not isolate permissions.** Restricted users from `createRoleWithPermissions` have no subscription, and `requireSubscription('todos')` runs before `requirePermission`, so their 403 comes from the subscription gate. Subscription gating itself is tested in `subscriptions-routes.test.ts`. When a new module copies this block for a subscription-gated route, give the restricted user an active subscription first, or the test passes for the wrong reason.
