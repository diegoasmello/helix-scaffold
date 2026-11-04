# todos module — frontend

Full CRUD module. Reference implementation for `apps/web` — the workspace `CLAUDE.md` uses this module as the canonical example.

Its E2E spec, `apps/web/e2e/todos.spec.ts` (create with the uploads and the rich text editor, view, edit, delete), is the reference for a module's spec — and `adminApi.createTodo()` in `e2e/fixtures.ts` the reference for a fixture that needs uploads. Both go away with the module in an app built on the scaffold.

## File structure

```
src/modules/todos/
├── types.ts
├── validation.ts
├── validation.test.ts
├── components/
│   ├── todos-form.tsx       ← shared form fields (create + edit)
│   └── todos-form.test.tsx  ← labels + required markers (route tests mock the form)
└── routes/
    ├── index.ts             ← route constants + todosRoutes array
    ├── todos-pending.tsx
    ├── todos-list.tsx
    ├── todos-create.tsx
    ├── todos-edit.tsx
    ├── todos-detail.tsx
    ├── todos-list.test.tsx
    ├── todos-create.test.tsx
    ├── todos-edit.test.tsx
    └── todos-detail.test.tsx
```

## Types (`types.ts`)

| Alias             | Source (`@helix/api-client/types`) |
| ----------------- | ---------------------------------- |
| `TodoItem`        | `Todo`                             |
| `TodoStatus`      | `TodoStatusEnumKey`                |
| `UploadItem`      | `Upload`                           |
| `CreateTodoInput` | `PostTodosMutationRequest`         |
| `UpdateTodoInput` | `PatchTodosIdMutationRequest`      |

`TodoFormValues` is a form-specific interface (not from the API):

```ts
interface TodoFormValues {
  title: string
  description: string
  content: string
  date: string | null      // DateInput returns string; null until user picks
  status: TodoStatus       // 'pending' | 'completed'
  attachments: UploadItem[] // multi-file upload field
  file: UploadItem | null  // single PDF upload field
  image: UploadItem | null // single image upload field
}
```

`status` is included in `TodoFormValues` even though the **create** API body does not accept it — on create, `status` is simply omitted when mapping values to `CreateTodoInput`. On edit, it is passed in `UpdateTodoInput`.

`attachments`, `file`, and `image` are mapped to `attachmentIds`, `fileId`, and `imageId` (arrays/strings of upload IDs) on submit. On edit, they are prefilled from `item.attachments`, `item.file`, and `item.image`.

## Form fields (`components/todos-form.tsx`)

| Field         | Component        | Notes                                                                |
| ------------- | ---------------- | -------------------------------------------------------------------- |
| `title`       | `TextInput`      | `form.getInputProps('title')`                                        |
| `description` | `Textarea`       | `resize="vertical"`                                                  |
| `content`     | `RichTextEditor` | `getInputProps` + `onUploadImage={uploadFile}`; produces an HTML string — **not** a plain Textarea. Its images are uploads the API finds in the HTML (`todo_content_images`) — the form sends nothing else for them |
| `date`        | `DateInput`      | `getInputProps`; the value is a date string (`DateStringValue`), not a `Date` |
| `status`      | `Switch`         | `checked={form.values.status === 'completed'}`, `form.setFieldValue` |
| `attachments` | `FilesInput`     | `onUpload={uploadFile}`, `maxFiles={10}` |
| `file`        | `FileInput`      | `accept={PDF_MIME_TYPE}`, `onUpload={uploadFile}` |
| `image`       | `FileInput`      | `accept={IMAGE_MIME_TYPE}`, `onUpload={uploadFile}` |

The form is split in three `FormSection`s — basic information (title, description, date + status), full text (content) and image and files (image, attachments, PDF). The detail screen uses `RichTextRenderer` (from `@helix/ui`) to render the `content` HTML string — never render it as plain text.

`uploadFile` is imported from `@/modules/uploads/service`. `FilesInput`, `FileInput`, `PDF_MIME_TYPE`, and `IMAGE_MIME_TYPE` come from `@helix/ui`. The detail screen renders attachments using `FilePreview` from `@helix/ui` inside a `SimpleGrid cols={{ base: 1, sm: 2 }}`.

## Validation (`validation.ts`)

```ts
title:       required, max 200 chars
description: required, max 500 chars
content:     required, max 1000 chars
date:        required (null → 'Required')
attachments: minFiles(1)   — 'At least one file is required'
file:        required      — fails when null
image:       required      — fails when null
```

`status` has no validator — the Switch is always in a valid state.

For upload fields, use `minFiles(n)` (from `@helix/ui`) for `FilesInput` and `required` for `FileInput`. Both validators treat `null` / empty array as invalid. The `required` prop on the component renders the asterisk indicator and must match the validator:

```tsx
<FilesInput required error={form.errors.attachments as string | undefined} ... />
<FileInput  required error={form.errors.file as string | undefined} ... />
```

## Routes (`routes/index.ts`)

| Constant          | Path              | Permission     |
| ----------------- | ----------------- | -------------- |
| `todoListRoute`   | `/todos`          | `todos:view`   |
| `todoCreateRoute` | `/todos/create`   | `todos:create` |
| `todoDetailRoute` | `/todos/$id`      | `todos:view`   |
| `todoEditRoute`   | `/todos/$id/edit` | `todos:edit`   |

Every route's `beforeLoad` is `guardPage(TODOS_ACCESS.<page>)` (`routes/access.ts`): each access has `feature: 'todos'` plus the permission, so `guardPage` checks the plan first (redirecting to `/upgrade?feature=todos`), then the permission — the same order as the API's `[requireSubscription('todos'), requirePermission(...)]`. It is the reference for gating routes by plan feature; see `src/modules/subscriptions/CLAUDE.md` → _Route guards_.

`todoListRoute` has `validateSearch` with: `page` (default 1), `pageSize` (default 10), `sortBy` (enum: `title | status | date | createdAt`, optional), `sortOrder` (default `'desc'`), `filters` (JSON string, optional — `filtersSearchParam` from `@/lib/list-filters`, which drops an invalid value), `filterLogic` (`'AND' | 'OR'`, default `'AND'`), `search` (optional — `searchSearchParam`; matches title or description).

`loaderDeps` forwards all six params so the loader re-runs on search changes.

## Data fetching hooks

- List: `useGetTodosSuspense({ page, pageSize, sortBy, sortOrder, filters, filterLogic })`
- Detail/Edit: `useGetTodosIdSuspense(id)`
- Loaders use `getTodosSuspenseQueryOptions(deps)` and `getTodosIdSuspenseQueryOptions(id)`

## Mutations

Inline in each component — no `hooks.ts`. Cache operations in `useMutation.onSuccess`; notifications and navigation in `mutate(data, { onSuccess, onError })`. `TodoCreate` / `TodoEdit` notify `apiErrorMessage(error, 'todos', 'notifications.createFailed' | 'notifications.updateFailed')`: `errors.invalid_upload` explains a file the API refused (one the user did not upload — API `assertUsableUploads()`).

**Create**: `resourceCache.changed('todos')`. Does NOT send `status`.  
**Update**: `resourceCache.saved('todos', updated)` — seeds the item cache, refetches the lists.  
**Delete**: `resourceCache.removed('todos', id)` — drops the item cache, refetches the lists. Both `TodoList` (row action) and `TodoDetail` (header button) delete; the detail navigates to `/todos` **before** dropping the cache, or its own query would refetch a 404.

## Sidebar

```ts
{ label: 'nav.todos', icon: IconChecklist, to: '/todos', access: TODOS_ACCESS.view }
```

## PDF export

`TodoList` has an Export PDF button that calls `GET /todos/export` with the current sort and filter state. The download is handled by the shared `downloadReport` helper (`src/lib/download-report.ts`).

The button is wired via the `useExportPdf` hook (`src/lib/use-export-pdf.ts`), which handles loading state, the `downloadReport` call, and success/error notifications. No permission guard wraps the button — `todoListRoute.beforeLoad` already requires `todos:view`, which is the same permission the export endpoint enforces.

See `apps/web/CLAUDE.md` → _PDF export_ for the full implementation guide and button wiring pattern.

## Filtering

`TodoList` has a `FilterBar` above the table (`getFilterBarProps(search, navigate)` from `@/lib/list-filters`). The filter fields and their backend equivalents:

| `FilterFieldDef.name` | Type | Backend column (`todos-schema.ts`) |
|-----------------------|------|-------------------------------------|
| `title` | `text` | `todos.title` |
| `description` | `text` | `todos.description` |
| `status` | `select` | `todos.status` |
| `date` | `date` | `todos.date` (needs `FILTER_COERCE` — see `todos-service.ts`) |

The `date` column is a Postgres `date` (a calendar day); the filter value arrives as `YYYY-MM-DD`. `FILTER_COERCE` in `todos-service.ts` (`coerceCalendarDay`) keeps it and skips anything else.

See `apps/web/CLAUDE.md` → _Filtering_ and `apps/api/CLAUDE.md` → _Filtering_ for the full implementation guide.

## Notes

- **Permission gating:** the Create button (header and empty state) sits in `<HasPermission resource="todos" action="create">`; the row actions Edit and Delete get `hidden: !hasPermission('todos', …)`; the detail header's Edit and Delete sit in `<HasPermission>`. The tests grant every `todos` action in `beforeEach` (`getMePermissionsHandler`) and check the hidden state with `grants: { todos: ['view'] }`. The buttons appear once `GET /me/permissions` resolves, so the tests find them with `findBy*`.
- `TodoItem` has a `slug`, for the public site only: it is not in `TodoFormValues`, not sent on create/edit and not shown on any screen (see `apps/web/CLAUDE.md` → _Types_).
- `content` is stored as an HTML string (rich text). Always use `RichTextEditor` for editing and `RichTextRenderer` for display.
- `attachments`, `file`, and `image` are all **required** upload fields. `attachments` uses `minFiles(1)`, `file` and `image` use `required`. All three have the `required` prop on their `FilesInput`/`FileInput` components to render the asterisk indicator.
- The upload fields (`attachments`, `file`, `image`) in `TodoFormValues` hold full `UploadItem` objects for previewing during the session. On submit they are mapped to IDs (`attachmentIds`, `fileId`, `imageId`). See `apps/web/CLAUDE.md` → _File uploads_ for the full pattern.
