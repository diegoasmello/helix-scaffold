# todos module — frontend

Full CRUD module. Reference implementation for `apps/web` — the workspace `CLAUDE.md` uses this module as the canonical example.

## File structure

```
src/modules/todos/
├── types.ts
├── validation.ts
├── validation.test.ts
├── components/
│   └── todos-form.tsx       ← shared form fields (create + edit)
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
| `content`     | `RichTextEditor` | Produces an HTML string; **not** a plain Textarea                    |
| `date`        | `DateInput`      | Value/onChange/error bound explicitly (not via `getInputProps`)      |
| `status`      | `Switch`         | `checked={form.values.status === 'completed'}`, `form.setFieldValue` |
| `attachments` | `FilesInput`     | `onUpload={uploadFile}`, `maxFiles={10}` |
| `file`        | `FileInput`      | `accept={PDF_MIME_TYPE}`, `onUpload={uploadFile}` |
| `image`       | `FileInput`      | `accept={IMAGE_MIME_TYPE}`, `onUpload={uploadFile}` |

The detail screen uses `RichTextRenderer` (from `@helix/ui`) to render the `content` HTML string — never render it as plain text.

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

`todoListRoute` has `validateSearch` with: `page` (default 1), `pageSize` (default 10), `sortBy` (enum: `title | status | date | createdAt`, optional), `sortOrder` (default `'desc'`), `filters` (JSON string, optional), `filterLogic` (`'AND' | 'OR'`, default `'AND'`).

`loaderDeps` forwards all four params so the loader re-runs on search changes.

## Data fetching hooks

- List: `useGetTodosSuspense({ page, pageSize, sortBy, sortOrder, filters, filterLogic })`
- Detail/Edit: `useGetTodosIdSuspense(id)`
- Loaders use `getTodosSuspenseQueryOptions(deps)` and `getTodosIdSuspenseQueryOptions(id)`

## Mutations

Inline in each component — no `hooks.ts`. Cache operations in `useMutation.onSuccess`; notifications and navigation in `mutate(data, { onSuccess, onError })`.

**Create**: invalidates `getTodosSuspenseQueryKey()`. Does NOT send `status`.  
**Update**: invalidates list + `setQueryData` on the item cache.  
**Delete**: invalidates list + `removeQueries` on the item cache. Delete mutation lives in `TodoList` (not the detail screen).

## Sidebar

```ts
{ label: 'Todos', icon: IconChecklist, to: '/todos', permission: { resource: 'todos', action: 'view' } }
```

## Filtering

`TodoList` has a collapsible filter panel. The filter fields and their backend equivalents:

| `FilterFieldDef.name` | Type | Backend column (`todos-schema.ts`) |
|-----------------------|------|-------------------------------------|
| `title` | `text` | `todos.title` |
| `description` | `text` | `todos.description` |
| `status` | `select` | `todos.status` |
| `date` | `date` | `todos.date` (needs `FILTER_COERCE` — see `todos-service.ts`) |

The `date` column is a `timestamp` in Postgres; the filter value arrives as an ISO string. `FILTER_COERCE` in `todos-service.ts` converts it with `new Date(v)` before passing to Drizzle.

See `apps/web/CLAUDE.md` → _Filtering_ and `apps/api/CLAUDE.md` → _Filtering_ for the full implementation guide.

## Notes

- Action buttons (Edit, Delete, Create) in `TodoList` are **not** wrapped in `<HasPermission>` — they are always rendered. If RBAC guards on action buttons are needed, wrap them per the workspace `CLAUDE.md` convention.
- `content` is stored as an HTML string (rich text). Always use `RichTextEditor` for editing and `RichTextRenderer` for display.
- `attachments`, `file`, and `image` are not validated — they are optional upload fields with no required constraint.
- The upload fields (`attachments`, `file`, `image`) in `TodoFormValues` hold full `UploadItem` objects for previewing during the session. On submit they are mapped to IDs (`attachmentIds`, `fileId`, `imageId`). See `apps/web/CLAUDE.md` → _File uploads_ for the full pattern.
