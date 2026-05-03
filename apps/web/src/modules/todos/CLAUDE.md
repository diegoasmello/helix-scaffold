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
| `CreateTodoInput` | `PostTodosMutationRequest`         |
| `UpdateTodoInput` | `PatchTodosIdMutationRequest`      |

`TodoFormValues` is a form-specific interface (not from the API):

```ts
interface TodoFormValues {
  title: string
  description: string
  content: string
  date: string | null // DateInput returns string; null until user picks
  status: TodoStatus // 'pending' | 'completed'
}
```

`status` is included in `TodoFormValues` even though the **create** API body does not accept it — on create, `status` is simply omitted when mapping values to `CreateTodoInput`. On edit, it is passed in `UpdateTodoInput`.

## Form fields (`components/todos-form.tsx`)

| Field         | Component        | Notes                                                                |
| ------------- | ---------------- | -------------------------------------------------------------------- |
| `title`       | `TextInput`      | `form.getInputProps('title')`                                        |
| `description` | `Textarea`       | `resize="vertical"`                                                  |
| `content`     | `RichTextEditor` | Produces an HTML string; **not** a plain Textarea                    |
| `date`        | `DateInput`      | Value/onChange/error bound explicitly (not via `getInputProps`)      |
| `status`      | `Switch`         | `checked={form.values.status === 'completed'}`, `form.setFieldValue` |

The detail screen uses `RichTextRenderer` (from `@helix/ui`) to render the `content` HTML string — never render it as plain text.

## Validation (`validation.ts`)

```ts
title:       required, max 200 chars
description: required, max 500 chars
content:     required, max 1000 chars
date:        required (null → 'Required')
```

`status` has no validator — the Switch is always in a valid state.

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
- `date` arrives from the API as a serialized value — the detail screen renders it with `<Text>{item.date}</Text>` without any formatting. Add a date formatting helper if display format becomes a requirement.
- `content` is stored as an HTML string (rich text). Always use `RichTextEditor` for editing and `RichTextRenderer` for display.
