# todos module — backend

Full CRUD module. Reference implementation for `apps/api` — the workspace `CLAUDE.md` uses this module as the canonical example for pagination, sorting, filtering, PDF export, file attachments (multi-file junction table, single-file FK columns **and** images inside rich text) and the **public API** (published todos a site reads without signing in — _Public routes_ below).

This module also serves as the **reference implementation for `requireSubscription`**. All todos routes require both an RBAC permission and an active subscription. When building a product on this scaffold, follow this module's route registration pattern for any feature that should be gated behind a subscription.

## Data model

**Table**: `todos` (`src/db/schema/todos.ts`)  
**Postgres enum**: `todo_status` — `'pending' | 'completed'`

| Column        | DB type                | Notes                           |
| ------------- | ---------------------- | ------------------------------- |
| `id`          | `text` PK              | UUIDv7, generated at insert     |
| `title`       | `text NOT NULL`        |                                 |
| `slug`        | `text NOT NULL`        | Unique index `todos_slug_unique` on `text_pattern_ops` (serves `=` and the prefix lookup of `uniqueSlug()`) — generated from `title` on create, never changed, never in a request body |
| `description` | `text NOT NULL`        |                                 |
| `normalizedTitle` | `text NOT NULL` | `normalizeText(title)` — written by the service, never returned |
| `normalizedDescription` | `text NOT NULL` | `normalizeText(description)` — same |
| `content`     | `text NOT NULL`        | Rich text (HTML string), stored sanitized (`sanitizeRichText()`), its images by path (`stripFileOrigins()` — `/api/files/<key>`, no origin) |
| `status`      | `todo_status NOT NULL` | Default `'pending'` at DB level |
| `date`        | `date NOT NULL`        | A calendar day, `YYYY-MM-DD` (`mode: 'string'`) — the same day in every time zone |
| `published`   | `boolean NOT NULL`     | Default `false`. Shown by the public API (`TODO_PUBLISHED`) |
| `publishedAt` | `timestamptz` (nullable) | Set by the service the first time `published` turns on, never changed or cleared, never in a request body. Check `todos_published_at_check`: a published row always has it. Partial index `todos_published_at_idx` (`published_at desc nulls first, id desc nulls first where published`) serves the public list's default sort, read forwards or backwards, without a sort |
| `fileId`      | `text` (nullable)      | FK → `uploads.id`, `ON DELETE SET NULL`, index `todos_file_id_idx` — single PDF |
| `imageId`     | `text` (nullable)      | FK → `uploads.id`, `ON DELETE SET NULL`, index `todos_image_id_idx` — single image |
| `createdAt`   | `timestamptz NOT NULL`   | `defaultNow()`                  |
| `updatedAt`   | `timestamptz NOT NULL`   | `$onUpdateFn(() => new Date())` |

**Junction table**: `todo_attachments` (`src/db/schema/todo-attachments.ts`) — `(todo_id, upload_id)` composite PK, both FKs `ON DELETE CASCADE`, index `todo_attachments_upload_id_idx` (the PK covers `todo_id` only). Holds the multi-file `attachments`.

**Junction table**: `todo_content_images` (`src/db/schema/todo-content-images.ts`) — same shape, index `todo_content_images_upload_id_idx`. Holds the uploads `content` shows as images; the service fills it from the HTML, and the API contract never mentions it (see `src/modules/uploads/CLAUDE.md` → _Images inside rich text_).

**Normalized text columns:** `TODO_NORMALIZED_FIELDS` (next to the table) maps `title`/`description` to their normalized copies. This module is the reference for the pattern — see `apps/api/CLAUDE.md` → _Normalized text columns_.

**Slug:** `TODO_SLUG` (next to the table) is the `SlugConfig` — column, constraint, fallback `todo`. This module is the reference for the pattern — see `apps/api/CLAUDE.md` → _Slugs_.

**Publication:** `TODO_PUBLISHED` (next to the table, `eq(todos.published, true)`) is the one definition of "public": the public service and the `isPublic` of the upload references filter with it. See `apps/api/CLAUDE.md` → _Public API_.

All four upload references (`todo_attachments.upload_id`, `todos.file_id`, `todos.image_id`, `todo_content_images.upload_id`) are registered in `src/config/upload-references.ts`, so the orphan cleanup job never deletes them and `GET /files/*` serves their files to the users `GET /todos/:id` lets in (`todos:view` and the `todos` feature). The file, the image and the content images — the ones `publicTodoSchema` returns — also have `isPublic`: while the todo is published, anyone opens them. The attachments are internal: no `isPublic`.

## Schema (`todos-schema.ts`)

- `todoSchema` — full entity returned by the API, including `slug`, `published` and `publishedAt`, with the uploads embedded: `attachments: Upload[]`, `file: Upload | null`, `image: Upload | null`. Registered with `.meta({ id: 'Todo', title: 'Todo' })` so swagger emits it as a named `$ref`
- `createTodoSchema` — `{ title, description, content, date, published, attachmentIds (min 1), fileId, imageId }`. All required but `published` (default `false`). **No `status` field** — status defaults to `'pending'` via the DB column default and is not accepted on create.
- `updateTodoSchema` — all fields optional: `title`, `description`, `content`, `status`, `date`, `published`, `attachmentIds` (min 1 when sent), `fileId`, `imageId`. This is the only way to change status.
- `todosExportQuerySchema` — sorting + filtering only (no pagination): `todosSortingSchema.merge(todosFilterQuerySchema)`. Used by `GET /todos/export`.
- `date` is `z.iso.date()` in the entity, create and update schemas: `YYYY-MM-DD` in and out, a datetime or an impossible day (`2025-02-30`) is a 400. See `apps/api/CLAUDE.md` → _2. Database schema_ → _Dates and times_.
- Sort columns: `['title', 'status', 'date', 'createdAt']`. Default sort: `createdAt`. `title` sorts by `normalizedTitle`; `id` breaks ties.
- Filter fields: `['title', 'description', 'status', 'published', 'date', 'createdAt']`.
- `slug` and `publishedAt` are in no request schema: sent in a body, Zod strips them.

## Service (`todos-service.ts`)

Factory `createTodosService(database, storage, baseUrl)` returns `{ list, getById, getBySlug, create, update, remove, generateReport }`. Not pure SQL — it also assembles the embedded uploads and cleans up storage, but that logic is covered by the route tests (`describe('Attachments')`), so there is no separate service test.

- `list` applies filters (`FILTER_COLUMNS`, `FILTER_COERCE` — `coerceCalendarDay` for `date`, which skips a value that is not a day, and `coerceInstant` for `createdAt`, which skips a value that is not an ISO datetime with its zone — `NORMALIZED_FILTER_COLUMNS` for the text operators on `title`/`description`) and the `search` param (`SEARCH_COLUMNS`: `normalizedTitle`, `normalizedDescription` — combined with `and()`), ordering (`SORT_COLUMNS`, then `id`) and pagination, then loads attachments (one query for the page, via `todo_attachments`) and the single `file`/`image` uploads (one `inArray` query).
- `getById` / `getBySlug` share `findOne(where)`, which assembles the embedded uploads.
- `create(data, actorId)` / `update(id, data, actorId)` first check the referenced uploads with `assertUsableUploads()` (`src/lib/upload-ownership.ts`): each `attachmentIds` / `fileId` / `imageId`, and each image of `content` (`uploadIdsInHtml()`, `src/lib/rich-text-uploads.ts`), must have been uploaded by `actorId` (`request.sessionUser.id`), or already belong to this todo on update (another editor re-sends them) — else **400** `invalid_upload`, before anything is written. In the same call, `imageId` and the images of `content` must be images (`IMAGE_TYPES`) and `fileId` a PDF (`PDF_TYPES`) — else **400** `invalid_upload_type`, on the todo's current files too; `attachmentIds` take any file. `update` answers `null` for an unknown id before looking at uploads.
- `create` and `update` pass `content` through `storedContent()` — `sanitizeRichText()` (`src/lib/sanitize-rich-text.ts`), then `stripFileOrigins()` (`src/lib/rich-text-uploads.ts`) — before anything else reads it: the images are found in the sanitized HTML, and stored by path, so a new `BASE_URL` breaks none.
- Every answer with `content` — `list`, `getById`, `getBySlug`, `create`, `update` — goes through `withContentUrls()`, which gives its images the API's origin back (`withFileOrigin(content, baseUrl)`). `baseUrl` is `env.BASE_URL`, passed by `app.ts` in the route options. See `apps/api/CLAUDE.md` → _Rich text fields_.
- `create` inserts the row with `normalizedValues(data, TODO_NORMALIZED_FIELDS)` (no `status` — the DB default applies), `publishedAt: published ? new Date() : null` and a slug from `withUniqueSlug(database, TODO_SLUG, title, insert)`, then inserts one `todo_attachments` row per `attachmentId` and one `todo_content_images` row per image of `content`.
- `update` updates only the sent columns, and the normalized copy of each text field sent (same `normalizedValues` call) — never the slug, even when `title` changes; with `published: true`, `publishedAt = coalesce(published_at, now())` (the first publication's date survives unpublishing and publishing again); when `attachmentIds` is sent it fully resyncs the junction rows (delete all, insert new), and when `content` is sent, its `todo_content_images` rows the same way. Returns `null` for an unknown id.
- `remove` is a hard delete: collects the todo's attachment, file, image and content image uploads (each once) → deletes the todo (cascades the junction rows) → deletes those `uploads` rows → deletes their storage keys, original + variants (best-effort, `Promise.allSettled`).
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
| `GET` | `/todos/by-slug/:slug` | `[requireSubscription('todos'), requirePermission('todos', 'view')]` | — |
| `POST` | `/todos` | `[requireSubscription('todos'), requirePermission('todos', 'create')]` | `request.audit('create', 'todos', id, body)` — 400 `invalid_upload`, `invalid_upload_type` |
| `PATCH` | `/todos/:id` | `[requireSubscription('todos'), requirePermission('todos', 'edit')]` | `request.audit('edit', 'todos', id, body)` — 400 `invalid_upload`, `invalid_upload_type` |
| `DELETE` | `/todos/:id` | `[requireSubscription('todos'), requirePermission('todos', 'delete')]` | `request.audit('delete', 'todos', id)` |

`GET /todos/by-slug/:slug` is the lookup of a public page (200 or 404); its explicit `operationId: 'getTodoBySlug'` keeps kubb from generating a broken mock (see `apps/api/CLAUDE.md` → _Slugs_). `GET /todos/export` does not clash with `GET /todos/:id`: Fastify's router (find-my-way) always prefers a static segment over a parametric one, whatever the registration order.

### Public routes (`todos-public-routes.ts`)

Registered in the public scope of `app.ts` (`publicApi.register(todosPublicRoutes, { database, baseUrl: env.BASE_URL })`, only with `publicApi.enabled`) — no session, no `preHandler`, rate limit and public cache from `registerPublicApi()`. The reference for `apps/api/CLAUDE.md` → _Public API_.

| Method | Path | `operationId` | Notes |
| --- | --- | --- | --- |
| `GET` | `/public/todos` | `getPublicTodos` | Published todos, paginated; `sortBy` `publishedAt` (default) / `date` / `title`, `sortOrder` defaulting to `desc` for `publishedAt` and `asc` for the others (`PUBLIC_TODO_DEFAULT_ORDER`), `id` breaking ties in the same direction; `search` on the title and description. No `filters` |
| `GET` | `/public/todos/:slug` | `getPublicTodoBySlug` | 200, or 404 for a draft and an unknown slug alike |

- `todos-public-schema.ts` — `publicTodoSchema` (`PublicTodo`): `slug`, `title`, `description`, `content`, `date`, `image` and `file` (`publicUploadSchema`), `publishedAt`, `updatedAt`. Left out on purpose: `id`, `status`, `attachments`, `createdAt`, the normalized columns. `publicTodosListQuerySchema`.
- `todos-public-service.ts` — `createTodosPublicService(database, baseUrl)` → `{ list, getBySlug }`. Explicit `select` (`PUBLIC_COLUMNS`, `PUBLIC_UPLOAD_COLUMNS`); every query adds `TODO_PUBLISHED` itself. `content` leaves with absolute image URLs (`withFileOrigin()`): a site on another domain inserts it as it comes.

### Route options signature

`todosRoutes` receives `requireSubscription` alongside `requirePermission`:

```ts
{ database, requirePermission, requireSubscription, storage, baseUrl }
```

`baseUrl` (`env.BASE_URL`) is for `content`'s images — a module without a rich text field does not take it.

When registering a new module that uses `requireSubscription`, mirror this pattern in `app.ts` and in the route module's options type.

### Behavior with `subscriptions.enabled: false`

When subscription mode is disabled, `requireSubscription('todos')` returns a no-op preHandler. Todos routes work exactly as before — the `[requireSubscription('todos'), requirePermission(...)]` array simply runs the permission check only. No code changes are needed to toggle this behavior.

`DELETE` returns `204` even when the id does not exist, but audits only a real deletion (`remove()` returns `false` for an unknown id).

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
- `POST /todos` sends `date` as a day (`'2025-03-20'`); `todoRow()` takes it the same way — plus real upload ids from the local `insertUpload()` helper (a `testDb.insert(uploads)` row owned by the test user — `uploadedBy: null` stands for someone else's; reuse it when a test needs uploads).
- `PATCH` asserts that fields not sent in the body (`description`) remain unchanged.
- `DELETE` asserts 204 both for existing and non-existing ids.
- Rows are inserted with `todoRow({...})` (`src/test/helpers.ts`), which fills the normalized columns and a unique `slug` (title + random suffix, unless given).
- `describe('Slug')` is the reference for the slug tests: generation, suffix, fallback, suffixed slug cut to 100 characters, concurrent creates, body `slug` ignored, stable on title change, unique index, `GET /todos/by-slug/:slug`.
- `describe('Normalized text columns')` is the reference for the pattern's tests: accent/case/whitespace-insensitive search and text filters, `eq` exact, sort, columns absent from the response, `POST`/`PATCH` writing them.
- `describe('Filtering')` is the reference for filter tests (see `apps/api/CLAUDE.md` → _Filtering_).
- `describe('Upload ownership')` — someone else's upload in `attachmentIds`/`fileId`/`imageId` on create (400, nothing written), an unknown id, adding one on update (400, attachments unchanged), another editor re-sending the todo's own files (200), 404 before the upload check.
- `describe('Date (a calendar day)')` — the day comes back as sent, a datetime or an impossible day is a 400, `PATCH` changes it; `describe('Filtering')` also skips a date condition that is not a day.
- `describe('Filtering by an instant (createdAt)')` — the reference for a filter on an instant: rows on both sides of a day's bounds in São Paulo, `between` the instants the web sends for that day keeps both bounds, `gte`/`lt` compare instants, and a bare day, a datetime without a zone or garbage is skipped.
- `describe('Upload types')` — a PDF as `imageId` and an image as `fileId` (400 `invalid_upload_type`, nothing written), a PDF inside `content`, any image type (SVG) as the image, any file as an attachment, a wrong type on update (the old image kept), the todo's own PDF moved to `imageId` (still refused), `invalid_upload` before the type for someone else's file.
- `describe('Images in the content')` — the reference for _Images inside rich text_: recorded on create, external images and unknown keys ignored, kept by the orphan cleanup (`deleteOrphanUploads()` with the registered loaders and `graceHours: 0`), someone else's image on create/update (400), another editor re-sending the text (200), a `PATCH` without `content` keeps them, an image taken out gets cleaned up, deleted with the todo.
- `describe('Attachments')` covers create/read/update of `attachmentIds` and that deleting a todo removes its attachment rows.
- `describe('Publication')` — the reference for the admin side of _Public API_: a draft by default, dated on create with `published: true` and on the first `PATCH`, the date kept on unpublish/republish and on a `PATCH` without `published`, a `publishedAt` in the body ignored, the audit, the `published` filter, the check constraint.
- `describe('Rich text sanitization')` — a script and event handlers removed on create (in the response and the row), a `javascript:` link on update, the images of the sanitized content still recorded.
- `describe('Image URLs in rich text')` — an absolute `src` of any origin stored as a path and answered with `BASE_URL` (create, update), absolute on every read (detail, `by-slug`, list), a `PATCH` without `content` changes nothing, the image still recorded in `todo_content_images`, a ` src=` inside `alt` never rewritten (stored and answered as sent — the XSS a regex allowed), an image from elsewhere kept as it is.
- `describe('Permission requirements')` — the module's `PERMISSION_REQUIREMENTS` through `PUT /roles/:id/permissions`: `todos:create` without `uploads:create` is a 400, `todos:edit` needs no upload.

## Public route tests (`todos-public-routes.test.ts`)

No session anywhere in the file. `insertTodo()` inserts a published todo (at `publishedAt`) unless `published: false`. Covers: `content`'s images with the absolute URL (`describe('Images inside content')`), the list (published only, newest first, pagination, sort by title/date — ascending without `sortOrder` —, the oldest first with `sortOrder=asc`, search on published only, a non-public sort column → 400, `filters` ignored, `pageSize` capped, public `Cache-Control`), by slug (200, a draft → 404 `no-store`, unknown → 404), _What a site sees_ (the exact keys of the list item and the detail, the uploads without id/storage key/name/uploader, the variants by URL, `null` image and file) and `publicApi.enabled: false` → 404. Who opens the files publicly: `upload-files-routes.test.ts` → `describe("A todo's files on the public API")`.

**Subscription in tests:** `createTestSession()` creates an active `pro` subscription for the test admin (subscriptions are always enabled in tests via `src/config/test-overrides.ts`), so individual tests never set one up.

**The permission block isolates permissions.** `requireSubscription('todos')` runs before `requirePermission`, so `createRestrictedSession` calls `grantActiveSubscription(email)`: every 403 then comes from the permission check, which each test confirms with `code: 'permission_denied'`. A control test (`todos:view` → 200 on `GET /todos`) proves the gate is passed. Subscription gating itself is tested in `subscriptions-routes.test.ts`. Copy this block for any subscription-gated module.
