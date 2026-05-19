# apps/web

React 19 + Vite — the main application.

## Stack

- **UI**: Mantine v9 + `@mantine/emotion` (Emotion-based CSS-in-JS)
- **Routing**: TanStack Router v1 (code-based, not file-based)
- **Data fetching**: TanStack Query v5
- **Forms**: `@mantine/form`
- **Icons**: Tabler Icons (`@tabler/icons-react`)

## Routing pattern

Routes are defined in code (not files). The flow is:

1. `src/routes.ts` — root of the route tree; assembles all routes
2. Each feature module exports its routes as **named constants** from `routes/index.ts` — never use a factory function pattern
3. Authenticated routes are children of the `authenticatedRoute`, which renders `AuthGuard`

To add a new feature module, create `src/modules/<feature>/routes/index.ts` exporting each route as a named constant and a combined array (e.g. `xxxRoutes`), then register it in `routes.ts`.

## Pagination and sorting

List routes store `page`, `pageSize`, `sortBy`, and `sortOrder` in the URL via `validateSearch`. This keeps the list state shareable, bookmarkable, and browser-history aware.

**`validateSearch`** — Zod schema applied to query string params. Provides defaults so clean URLs (`/todos`) resolve to `page=1&pageSize=10` without redirects:

```ts
validateSearch: z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  sortBy: z.enum(["title", "createdAt"]).optional(),  // columns must match the API's enum
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}),
```

**`loaderDeps`** — forwards the search params to the loader. Without this, TanStack Router won't re-run the loader when only the search changes:

```ts
loaderDeps: ({ search: { page, pageSize, sortBy, sortOrder } }) => ({
  page, pageSize, sortBy, sortOrder,
}),
loader: ({ deps }) =>
  queryClient.ensureQueryData(getXxxsSuspenseQueryOptions(deps)),
```

**DataTable** (`@helix/ui`) bridges URL state and UI via two helpers that produce the required props from the search params and navigate function — see the _List screen_ guide in _Creating a new module_ for the full usage pattern:

- `getDataTablePaginationProps(response, search, navigate)` — produces `totalRecords`, `page`, `onPageChange`, `recordsPerPage`, `recordsPerPageOptions`, `onRecordsPerPageChange`; page-size changes reset `page` to 1
- `getDataTableSortingProps(search, navigate)` — produces `sortStatus` (`undefined` when no column is sorted) and `onSortStatusChange`; sort changes always reset `page` to 1

### TanStack Router hooks

**Always** use the hooks derived from the route constant — never import `useNavigate`, `useParams` or `useSearch` directly from `@tanstack/react-router`:

```ts
// ✅ correct — typed to this route's params/search
const navigate = xxxListRoute.useNavigate()
const { page, pageSize } = xxxListRoute.useSearch()

// ❌ wrong — loses type-safety and breaks integration test mocks
import { useNavigate, useSearch } from '@tanstack/react-router'
```

This applies to every route hook (`useNavigate`, `useSearch`, `useParams`, `useLoaderData`).

### Default rule: list screens always use DataTable

Every new module list screen uses `DataTable` with full pagination and sorting. **Never use a plain `Table` for a list screen**, even when the dataset is expected to be small. `DataTable` handles the empty state and provides a consistent UX across all modules.

When asked to create a new module, always generate the list screen with `DataTable`, `getDataTablePaginationProps`, and `getDataTableSortingProps` — unless the prompt explicitly asks for something different.

### Select-field queries are not paginated

When a field needs all records from another module (e.g. a role selector in the Users form), use a dedicated `/all` endpoint that returns an unfiltered array without pagination. These queries use `getXxxAllSuspenseQueryOptions()` — not the paginated `getXxxsSuspenseQueryOptions()`. Never pass `page`/`pageSize` to a select-field query.

## Filtering

List screens can optionally show a collapsible filter panel that lets users combine field conditions with AND/OR logic. The filter state lives entirely in the URL (two extra search params: `filters` and `filterLogic`). The panel open/close state is local only — not persisted in the URL.

### URL shape

Add two params to the route's `validateSearch`:

```ts
validateSearch: z.object({
  // ...existing pagination + sorting params
  filters: z.string().optional(),              // JSON-encoded FilterCondition[]
  filterLogic: z.enum(['AND', 'OR']).default('AND'),
}),
```

`filters` is stored as a raw JSON string because TanStack Router only auto-serialises primitives. The frontend `JSON.stringify`s the conditions array before putting it in the URL; the backend `JSON.parse`s it (and validates field names) on the server side.

Update `loaderDeps` to forward the new params so the loader re-runs when they change:

```ts
loaderDeps: ({ search: { page, pageSize, sortBy, sortOrder, filters, filterLogic } }) => ({
  page, pageSize, sortBy, sortOrder, filters, filterLogic,
}),
```

Pass them to the suspense hook too:

```ts
const { data: xxxResponse } = useGetXxxsSuspense({ page, pageSize, sortBy, sortOrder, filters, filterLogic })
```

### `LogicalFilterForm` component (`@helix/ui`)

The reusable filter UI lives in `packages/ui`. Import `LogicalFilterForm`, `FilterFieldDef`, and `LogicalFilterValue` from `@helix/ui`.

**Define filter fields** in the list file (module-specific):

```ts
const XXX_FILTER_FIELDS: FilterFieldDef[] = [
  { name: 'title',  label: 'Title',  type: 'text' },
  { name: 'status', label: 'Status', type: 'select',
    options: [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }] },
  { name: 'date',   label: 'Date',   type: 'date' },
]
```

Supported `type` values: `'text'` | `'number'` | `'boolean'` | `'date'` | `'select'`. The `name` values must match the field names declared in `XXX_FILTER_FIELDS` on the backend (`apps/api/src/modules/xxx/xxx-schema.ts`).

**State and handlers** in the list component:

```ts
const [filtersOpen, setFiltersOpen] = useState(false)
const { ..., filters, filterLogic } = xxxListRoute.useSearch()

// Auto-open the panel when the page loads with active filters (e.g. bookmarked URL)
useEffect(() => {
  if (filters) setFiltersOpen(true)
}, []) // eslint-disable-line react-hooks/exhaustive-deps

const filterValue: LogicalFilterValue = {
  conditions: filters ? (JSON.parse(filters) as LogicalFilterValue['conditions']) : [],
  logic: filterLogic,
}
const activeFilterCount = filterValue.conditions.length

const handleApplyFilters = (value: LogicalFilterValue) => {
  const hasFilters = value.conditions.length > 0
  navigate({
    search: (prev) => ({
      ...prev,
      filters: hasFilters ? JSON.stringify(value.conditions) : undefined,
      filterLogic: value.logic,
      page: 1,   // always reset to page 1 when filters change
    }),
  })
  if (!hasFilters) setFiltersOpen(false)
}
```

**Filters button** (add to `PageList` `actions`, before the Create button):

```tsx
<Button
  variant={activeFilterCount > 0 ? 'light' : 'default'}
  leftSection={<IconFilter size={16} />}
  onClick={() => setFiltersOpen((o) => !o)}
  rightSection={
    activeFilterCount > 0 ? (
      <Badge size="xs" circle>{activeFilterCount}</Badge>
    ) : undefined
  }
>
  Filters
</Button>
```

**Filter panel** (between `PageList` header and `DataTable`):

```tsx
<Collapse expanded={filtersOpen}>
  <Paper withBorder p="md" mb="md">
    <LogicalFilterForm
      key={filters ?? ''}
      fields={XXX_FILTER_FIELDS}
      value={filterValue}
      onApply={handleApplyFilters}
    />
  </Paper>
</Collapse>
```

The `key={filters ?? ''}` causes the form to remount whenever the active filter string changes (e.g. browser back/forward), so the form stays in sync with the URL.

### Tests

Add a `describe('Filter panel')` block to the list test file. Required cases:

| Test | What to verify |
|------|----------------|
| No active filters | Filters button renders with no badge |
| Click Filters | Panel opens (find `'Add filter'` button asynchronously) |
| Click Filters again | Panel closes |
| `useSearch` returns active filters | Badge shows correct count (scope with `within(filtersBtn)` to avoid pagination collisions) |
| Page loads with active filters | Panel auto-opens |
| Click Add filter | A condition row appears |
| Fill value + click Apply | `navigate` called with JSON-encoded `filters` and `page: 1` |
| Click Clear | `navigate` called with `filters: undefined` and `page: 1` |

Always use `findByRole` (async) for assertions after click — Mantine's `Collapse` animation is asynchronous. Use `within(filtersBtn).getByText('1')` for badge assertions to avoid false matches from pagination controls.

See `apps/web/src/modules/todos/routes/todos-list.test.tsx` → `describe('Filter panel')` for the reference implementation.

---

## Auth

`src/core/auth/` contains the full auth layer:

- `useAuth()` — returns `{ user, grants, isPending, isAuthenticated, hasPermission(resource, action) }`. Fetches the session via `better-auth` and the user's grants via `GET /me/permissions` (cached 30 s).
- `HasPermission` — renders children only when the current user has the required permission; renders nothing otherwise:

```tsx
import { HasPermission } from '../../../core/auth/has-permission'
;<HasPermission resource="features" action="create">
  <Button onClick={() => navigate({ to: '/features/create' })}>Create</Button>
</HasPermission>
```

- `AuthGuard` — protects authenticated routes; redirects unauthenticated users to `/login`

### Route-level permission guards

Every protected route must declare a `beforeLoad` that checks the required permission and redirects to `/403` if the user lacks it. The `hasPermission` function is injected into the router context by `authenticatedRoute.beforeLoad` in `routes.ts` (which fetches the session and permissions before any child route renders).

```ts
const xxxListRoute = createRoute({
  // ...
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('xxx', 'view')) throw redirect({ to: '/403' })
  },
})
```

Permission per route type:

| Route                  | Action   |
| ---------------------- | -------- |
| list (`/xxx`)          | `view`   |
| detail (`/xxx/$id`)    | `view`   |
| create (`/xxx/create`) | `create` |
| edit (`/xxx/$id/edit`) | `edit`   |

The `/403` page (`src/modules/errors/forbidden.tsx`) renders inside the app layout so the user can navigate to sections they do have access to. The `/404` and generic error pages (`src/modules/errors/`) are full-screen and set on `createRootRoute`.

## Module structure convention

Each module lives under `src/modules/<feature>/`. The `routes/` subdirectory is always a directory. Everything else starts as a flat file and becomes a directory only when it grows:

```
modules/news/
├── routes/          ← always a directory (required by routing pattern)
│   ├── index.ts     ← routes exported as named constants + combined array
│   ├── news-list.tsx
│   └── news-create.tsx
├── components/      ← directory if more than one component
├── service.ts       ← flat until it needs splitting
├── hooks.ts         ← flat until it needs splitting
└── types.ts
```

App-specific components that are not reusable belong in the module's `components/`. Reusable components built on top of Mantine belong in `packages/ui`.

## Shared UI package (`packages/ui`)

`packages/ui` is a **local workspace package** (not published to npm). It is the single source of truth for all UI imports — it re-exports everything from Mantine, Tabler Icons, and clsx, and provides custom components built on top of Mantine.

`apps/web` never imports directly from `@mantine/*`, `@tabler/icons-react`, or `clsx` — everything comes from `@helix/ui`.

`SidebarItem.to` and `SidebarLink.to` are typed as `AppRoute`, derived from TanStack Router's `RegisteredRouter`. Only routes registered in `routes.ts` are valid values — TypeScript will enforce this.

## App layout

`src/app.tsx` renders `<Layout>` from `@helix/ui`, which uses Mantine's `AppShell` with:

- **Header**: breadcrumbs (auto-populated from route `staticData`) + `UserMenu`
- **Navbar**: driven by `sidebarItems` from `src/config/sidebar.ts`
- **Main**: `<Outlet />` renders the active route

## Theme

Two-level theming:

- `src/config/theme.ts` — app-level Mantine theme (primary color `"main"`), uses `createTheme()` from `@helix/ui`
- `packages/ui/src/theme/index.ts` — sets font defaults (Inter + Plus Jakarta Sans) and exports `createTheme()` helper

### Styling conventions

**Always use `createStyles` + `useStyles` — never the `style` prop.** Inline `style={{…}}` on any component is forbidden; move every CSS rule into a `createStyles` block:

```tsx
// ✅ correct
const { classes } = useStyles()
<Text className={classes.label}>…</Text>

const useStyles = createStyles(() => ({
  label: css`letter-spacing: 0.5px;`,
}))

// ❌ wrong
<Text style={{ letterSpacing: '0.5px' }}>…</Text>
```

**Only declare `createStyles` parameters you actually use** — `() => ({})`, `(theme) => ({})`, or `(theme, _, u) => ({})`. Never declare a parameter you don't reference.

**Theme tokens over raw CSS variables** — always `${theme.spacing.*}` / `${theme.colors.*[shade]}`, never `var(--mantine-*)`.

This applies to both `packages/ui` components and any `createStyles` used in `apps/web`.

---

## Creating a new module (CRUD)

When asked to create a new feature module, follow this pattern exactly. Use the `todos` module as reference implementation.

### 1. File structure

```
src/modules/<feature>/
├── types.ts          ← domain types + input types
├── hooks.ts          ← only when mutations are shared across 2+ components (see step 4)
├── validation.ts     ← shared form validation (when create + edit share a form)
├── routes/
│   ├── index.ts              ← named route constants + combined array export
│   ├── <feature>-pending.tsx ← suspense fallback (Center + Loader)
│   ├── <feature>-list.tsx
│   ├── <feature>-create.tsx
│   ├── <feature>-edit.tsx
│   └── <feature>-detail.tsx
└── components/
    └── <feature>-form.tsx    ← shared form fields for create + edit
```

### 2. Types (`types.ts`)

Re-export the generated types from `@helix/api-client/types` under semantic module-level names. Do not redeclare schemas in Zod — the source of truth lives in `apps/api`. Keep `XxxFormValues` as a plain TypeScript interface; it is form-specific and does not come from the API.

```ts
import type {
  Xxx,
  XxxStatusEnumKey,
  PostXxxsMutationRequest,
  PatchXxxsIdMutationRequest,
} from '@helix/api-client/types'

export type XxxItem = Xxx
export type XxxStatus = XxxStatusEnumKey
export type CreateXxxInput = PostXxxsMutationRequest
export type UpdateXxxInput = PatchXxxsIdMutationRequest

// Form-specific — not an API type; stays as interface
export interface XxxFormValues {
  // fields used by the form (may differ from API types, e.g. date as string | null)
}
```

The semantic aliases (`XxxItem`, `XxxStatus`, etc.) give stable, readable names to the rest of the module. The generated names (`Xxx`, `XxxStatusEnumKey`, `PostXxxsMutationRequest`) are an implementation detail of kubb and may change across regenerations.

**`date` fields**: kubb generates `date: any` for `z.date()` / `z.coerce.date()` in request bodies (known limitation — see `packages/api-client/CLAUDE.md`). `string` is assignable to `any`, so passing a string works at runtime. No workaround needed in `types.ts`.

### 3. Hooks and data fetching

`@helix/api-client/hooks` exports fetchers, queryKey helpers, queryOptions, and React Query hooks for each endpoint. Use them directly — do not write wrappers without a reason.

**Reads (queries)** — never need a `hooks.ts`. Use the generated hooks and queryOptions directly where needed:

```ts
// In components — generated suspense hook
// The list hook receives pagination and sorting params via loaderDeps (see Step 4)
import { useGetXxxsSuspense, useGetXxxsIdSuspense } from "@helix/api-client/hooks";

const { page, pageSize, sortBy, sortOrder } = xxxListRoute.useSearch();
const { data: xxxResponse } = useGetXxxsSuspense({ page, pageSize, sortBy, sortOrder });
// xxxResponse: { data: XxxItem[], total, page, pageSize, totalPages }

const { data: item } = useGetXxxsIdSuspense(id);

// In loaders (routes/index.ts) — generated queryOptions
import { getXxxsSuspenseQueryOptions, getXxxsIdSuspenseQueryOptions } from "@helix/api-client/hooks";

loader: ({ deps }) => queryClient.ensureQueryData(getXxxsSuspenseQueryOptions(deps)),
loader: ({ params }) => queryClient.ensureQueryData(getXxxsIdSuspenseQueryOptions(params.id)),
```

**Mutations** — inline in the component that uses them, with cache invalidation:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  postXxxs,
  patchXxxsId,
  deleteXxxsId,
  getXxxsSuspenseQueryKey,
  getXxxsIdSuspenseQueryKey,
} from '@helix/api-client/hooks'
import type { CreateXxxInput, UpdateXxxInput } from '../types'

// Create — invalidates the list
const queryClient = useQueryClient()
const { mutate: createXxx } = useMutation({
  mutationFn: (data: CreateXxxInput) => postXxxs(data),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: getXxxsSuspenseQueryKey(),
      exact: true,
    })
  },
})

// Update — invalidates the list and updates the item cache
const { mutate: updateXxx } = useMutation({
  mutationFn: ({ id, data }: { id: string; data: UpdateXxxInput }) =>
    patchXxxsId(id, data),
  onSuccess: (updated) => {
    queryClient.invalidateQueries({
      queryKey: getXxxsSuspenseQueryKey(),
      exact: true,
    })
    queryClient.setQueryData(getXxxsIdSuspenseQueryKey(updated.id), updated)
  },
})

// Delete — invalidates the list and removes the item from cache
const { mutate: deleteXxx } = useMutation({
  mutationFn: (id: string) => deleteXxxsId(id),
  onSuccess: (_, id) => {
    queryClient.invalidateQueries({
      queryKey: getXxxsSuspenseQueryKey(),
      exact: true,
    })
    queryClient.removeQueries({ queryKey: getXxxsIdSuspenseQueryKey(id) })
  },
})
```

**Separation of concerns in mutations:**

- `useMutation` (`onSuccess`) — reserved for cache operations (invalidation, `setQueryData`, `removeQueries`). Always fires, even if the component has unmounted.
- `mutate(data, { onSuccess, onError })` — component-dependent side effects: `notify()` and `navigate()`. Only fires if the component is still mounted. **Always declare both `onSuccess` and `onError` with `notify()`** in this scenario.

```ts
createXxx(data, {
  onSuccess: () => {
    notify({ status: 'success', message: 'Xxx created successfully' })
    navigate({ to: '/xxx' })
  },
  onError: () => {
    notify({ status: 'danger', message: 'Failed to create xxx' })
  },
})

updateXxx(
  { id, data },
  {
    onSuccess: () => {
      notify({ status: 'success', message: 'Xxx updated successfully' })
      navigate({ to: '/xxx' })
    },
    onError: () => {
      notify({ status: 'danger', message: 'Failed to update xxx' })
    },
  }
)

deleteXxx(id, {
  onSuccess: () => {
    notify({ status: 'success', message: 'Xxx deleted successfully' })
  },
  onError: () => {
    notify({ status: 'danger', message: 'Failed to delete xxx' })
  },
})
```

**When to create `hooks.ts`** — only in two cases:

1. The same mutation with the same invalidation logic is used in 2 or more components
2. The invalidation logic is complex: optimistic updates, rollback, conditional invalidation

Outside these cases, keeping the mutation inline is preferable — avoids indirection without real benefit.

### 4. Routes (`routes/index.ts`)

Export each route as a named constant and collect them in a combined array. **Never use a factory function** — `getParentRoute` receives `authenticatedRoute` directly:

```ts
import { z } from 'zod'
import { createRoute, redirect } from '@tanstack/react-router'
import { authenticatedRoute } from '@/routes'

export const xxxListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/xxx',
  component: XxxList,
  pendingComponent: XxxPending,
  staticData: { breadcrumbs: [{ label: 'Xxx' }] },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('xxx', 'view')) throw redirect({ to: '/403' })
  },
  // Pagination + sorting stored in URL params — provides defaults so /xxx works without query string
  validateSearch: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['field1', 'field2', 'createdAt']).optional(), // columns must match API enum
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  // loaderDeps makes the loader re-run whenever any of these params change
  loaderDeps: ({ search: { page, pageSize, sortBy, sortOrder } }) => ({
    page,
    pageSize,
    sortBy,
    sortOrder,
  }),
  loader: ({ deps }) =>
    queryClient.ensureQueryData(getXxxsSuspenseQueryOptions(deps)),
})

export const xxxCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/xxx/create',
  component: XxxCreate,
  // ...
})

// ... detail and edit routes

export const xxxRoutes = [
  xxxListRoute,
  xxxCreateRoute,
  xxxDetailRoute,
  xxxEditRoute,
]
```

Each route must have:

- `pendingComponent: XxxPending`
- `staticData: { breadcrumbs: [...] }` — see breadcrumb convention below
- `beforeLoad` — permission guard (see below)
- `loader` — call `queryClient.ensureQueryData(...)` for required data; fire-and-forget for secondary data (lookups, select options)

The list route additionally requires `validateSearch` and `loaderDeps` — without `loaderDeps`, TanStack Router won't re-run the loader when only the search params change.

For item routes (`$id`, `$id/edit`), the loader returns the item so the breadcrumb function receives it as `loaderData`.

**Permission guard** — every route must check the required permission via `context.hasPermission` and redirect to `/403` if the user lacks it:

```ts
import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router'

const xxxListRoute = createRoute({
  // ...
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('xxx', 'view')) throw redirect({ to: '/403' })
  },
})

const xxxCreateRoute = createRoute({
  // ...
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('xxx', 'create')) throw redirect({ to: '/403' })
  },
})

const xxxDetailRoute = createRoute({
  // ...
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('xxx', 'view')) throw redirect({ to: '/403' })
  },
})

const xxxEditRoute = createRoute({
  // ...
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('xxx', 'edit')) throw redirect({ to: '/403' })
  },
})
```

Use the same resource string registered in `apps/api/src/config/permissions.ts`.

### 5. Breadcrumb convention

```ts
// List
staticData: {
  breadcrumbs: [{ label: 'Xxx' }]
}

// Create
staticData: {
  breadcrumbs: [{ label: 'Xxx', to: '/xxx' }, { label: 'Create' }]
}

// Detail
staticData: {
  breadcrumbs: [
    { label: 'Xxx', to: '/xxx' },
    { label: 'View' },
    (data) => ({ label: `#${(data as XxxItem).id}` }),
  ]
}

// Edit
staticData: {
  breadcrumbs: [
    { label: 'Xxx', to: '/xxx' },
    { label: 'Edit' },
    (data) => ({ label: `#${(data as XxxItem).id}` }),
  ]
}
```

### 6. Screen components

Use the page wrapper components from `@helix/ui`:

| Screen | Wrapper      | Key props                                                                      |
| ------ | ------------ | ------------------------------------------------------------------------------ |
| List   | `PageList`   | `title`, `actions` (Create button)                                             |
| Create | `PageCreate` | `title`, `children` (form fields), `footerActions` (Cancel + Save)             |
| Edit   | `PageEdit`   | `title`, `children` (form fields), `footerActions` (Cancel + Save)             |
| Detail | `PageView`   | `title` (item name), `footerActions` (Back button), `children` (LabeledValues) |

**Footer button conventions** — apply to every Create, Edit, and Detail screen:

- **Cancel / Back**: `size="md" variant="secondary"` — neutral action, never draws attention
- **Save / Submit**: `size="md"` with default variant — primary action, uses the app's primary color
- Always wrap footer buttons in `<Group justify="flex-end">` so they align to the right

**List screen (`PageList` + `DataTable`)** — the DataTable drives pagination and sorting. Columns that map to a sortable API field get `sortable: true`. All state lives in the URL via the route's `useSearch()`.

Use `getDataTablePaginationProps` and `getDataTableSortingProps` from `@helix/ui` to derive the DataTable props — never build them manually:

```tsx
import { DataTable, getDataTablePaginationProps, getDataTableSortingProps, type DataTableColumn } from "@helix/ui";

const navigate = xxxListRoute.useNavigate();
const search = xxxListRoute.useSearch();
const { page, pageSize, sortBy, sortOrder } = search;
const { data: xxxResponse } = useGetXxxsSuspense({ page, pageSize, sortBy, sortOrder });

const paginationProps = getDataTablePaginationProps(xxxResponse, search, navigate);
const sortingProps = getDataTableSortingProps(search, navigate);

const columns: DataTableColumn<XxxItem>[] = [
  { accessor: "title", title: "Title", sortable: true, width: "60%" },
  { accessor: "createdAt", title: "Created", sortable: true },
  { accessor: "actions", title: "Actions", textAlign: "center", width: 240, render: ... },
];

<DataTable
  records={xxxResponse.data}
  columns={columns}
  {...paginationProps}
  {...sortingProps}
/>
```

`getDataTablePaginationProps(response, search, navigate)` — derives `totalRecords`, `page`, `onPageChange`, `recordsPerPage`, `recordsPerPageOptions` (fixed at `[5, 10, 15, 20]`), and `onRecordsPerPageChange` (resets `page` to 1).

`getDataTableSortingProps(search, navigate)` — derives `sortStatus` (`undefined` when `sortBy` is absent, so headers render unsorted) and `onSortStatusChange` (always resets `page` to 1 when sort changes).

Form screens use the `<Form>` component from `@helix/ui` wrapping `PageCreate`/`PageEdit`. `Form` receives `form` (the `useForm` instance) and `onSubmit` (a plain function that receives the validated values — not `form.onSubmit(...)`). It handles validation and submission internally.

**Per-row action buttons** — always use `Button size="xs" variant="secondary"` with a text label. Never use `ActionIcon` with an icon in the actions column:

```tsx
// View is always visible — reading the list already requires `features:view`
<Button size="xs" variant="secondary" aria-label="View" onClick={() => navigate({ to: "/features/$id", params: { id: item.id } })}>
  View
</Button>
<HasPermission resource="features" action="edit">
  <Button size="xs" variant="secondary" aria-label="Edit" onClick={() => navigate({ to: "/features/$id/edit", params: { id: item.id } })}>
    Edit
  </Button>
</HasPermission>
<HasPermission resource="features" action="delete">
  <Button size="xs" variant="secondary" aria-label="Delete" onClick={() => handleDelete(item.id)}>
    Delete
  </Button>
</HasPermission>
```

**Create button** (in `PageList` `actions` prop) — wrap with `<HasPermission>`:

```tsx
<HasPermission resource="features" action="create">
  <Button leftSection={<IconPlus size={16} />} onClick={() => navigate({ to: "/features/create" })}>
    Create
  </Button>
</HasPermission>
```

### 7. Shared form component

When create and edit share the same fields, extract them into `components/<feature>-form.tsx` instead of duplicating. The shared component renders **only the fields** — no page wrapper, no footer actions:

```tsx
export interface XxxFormValues {
  /* form fields */
}

interface XxxFormProps {
  form: UseFormReturnType<XxxFormValues>
}

export function XxxForm(props: Readonly<XxxFormProps>) {
  const { form } = props
  return <Grid>{/* shared fields */}</Grid>
}
```

The route file owns the page wrapper, title, and footer actions:

```tsx
// xxx-create.tsx
const handleSubmit = (values: XxxFormValues) => {
  createXxx(
    {
      /* map values to API input */
    },
    {
      onSuccess: () => {
        notify({ status: 'success', message: 'Xxx created successfully' })
        navigate({ to: '/xxx' })
      },
      onError: () => {
        notify({ status: 'danger', message: 'Failed to create xxx' })
      },
    }
  )
}

return (
  <Form<XxxFormValues> form={form} onSubmit={handleSubmit}>
    <PageCreate title="Create Xxx" footerActions={<Group>...</Group>}>
      <XxxForm form={form} />
    </PageCreate>
  </Form>

  // xxx-edit.tsx
)
;<Form<XxxFormValues> form={form} onSubmit={handleSubmit}>
  <PageEdit title="Edit Xxx" footerActions={<Group>...</Group>}>
    <XxxForm form={form} />
  </PageEdit>
</Form>
```

- `XxxFormValues` must be exported — route files use it to type `useForm<XxxFormValues>()`
- Add `isEditing?: boolean` to `XxxFormProps` only if the fields themselves differ between create and edit

### 8. Forms (`@mantine/form`)

```ts
const form = useForm<XxxFormValues>({
  initialValues: {
    /* spec fields */
  },
  validate: xxxFormValidate,
})
```

- Text fields: `{...form.getInputProps("field")}`
- Switch/checkbox: `{...form.getInputProps("field", { type: "checkbox" })}`
- Select and DateInput: bind `value` and `onChange` + `error` explicitly
- Status toggles (e.g. `pending | completed`): use `Switch`, store the domain value in the form, set via `form.setFieldValue`

Validation lives in `validation.ts`, typed against the form values. Use `satisfies` instead of a type annotation — TypeScript validates compatibility with Mantine's type but infers the concrete object shape, avoiding union/optional issues:

```ts
import type { UseFormInput } from '@helix/ui'
import type { XxxFormValues } from './types'

export const xxxFormValidate = {
  field: (v: string) => (!v.trim() ? 'Required' : null),
} satisfies UseFormInput<XxxFormValues>['validate']
```

### 9. Register the module

**`src/routes.ts`:**

```ts
import { xxxRoutes } from './modules/xxx/routes'
// add ...xxxRoutes to authenticatedRoute.addChildren([...])
```

**`src/config/sidebar.ts`:**

```ts
{ label: "Xxx", icon: IconXxx, to: "/xxx", permission: { resource: "xxx", action: "view" } }
```

The `permission` field controls sidebar visibility — `app.tsx` filters items using `hasPermission` before passing them to `<Layout>`. Use the same resource string registered in `apps/api/src/config/permissions.ts`.

### 10. Delete confirmation

Use `confirm()` from `@helix/ui` — no local state, no modal JSX:

```ts
import { confirm } from '@helix/ui'

const handleDelete = (id: string) => {
  confirm({
    status: 'danger',
    title: 'Delete Xxx',
    message: 'Are you sure? This action cannot be undone.',
    confirmLabel: 'Delete',
    onConfirm: () => deleteXxx(id),
  })
}
```

The confirm button is automatically colored with `status: "danger"`. `onConfirm` is called when the user confirms — the modal closes automatically via `ModalsProvider`. Always pass `confirmLabel: 'Delete'` explicitly — the default label is `'Confirm'`, so omitting it produces a button that says "Confirm" instead of "Delete", which will break tests that assert `getByRole('button', { name: 'Delete' })`.

### 11. Tests

Every module ships with tests. A module is only complete when all three levels are covered.

**Unit — `validation.test.ts`**

One `describe` per field. Cover: empty, boundary values, valid input.

**Integration — `routes/<feature>-list.test.tsx`, `routes/<feature>-create.test.tsx`, `routes/<feature>-edit.test.tsx`, `routes/<feature>-detail.test.tsx`**

Use MSW to control API responses. Add the module's endpoints to `src/mocks/handlers.ts` as default handlers, then override per test as needed. See the Testing section below for the full pattern and coverage table.

**E2E — `e2e/<feature>.spec.ts`**

One helper function per data-creation step (e.g. `createXxx`). Cover: list, create, detail, edit, delete (confirm + cancel). Each test creates its own data — no shared state.

---

## Testing

**Commands:**

```bash
pnpm test              # Single run (used by Turbo / CI)
pnpm test:watch        # Watch mode for local development
pnpm test:coverage     # Single run with coverage report
pnpm test:e2e          # Playwright (requires dev server + API running)
pnpm test:e2e:ui       # Playwright with interactive UI
```

### Levels and scope

| Level       | Tool               | What to test                                                                   |
| ----------- | ------------------ | ------------------------------------------------------------------------------ |
| Unit        | Vitest             | `validation.ts` — pure validator functions; service logic when non-trivial     |
| Integration | Vitest + RTL + MSW | Route components — rendering, form flows, modal interactions, API error states |
| E2E         | Playwright         | Full CRUD flows per module against the real backend                            |

### MSW setup

MSW intercepts `fetch` calls at the network layer — no mocking of modules or functions. Two files support this:

- **`src/mocks/handlers.ts`** — default handlers (safe fallbacks: empty lists, 204s). Uses the generated handler functions from `@helix/api-client/mocks`. Add an entry here when a new API endpoint is introduced.
- **`src/mocks/server.ts`** — `setupServer` wired to those handlers.

`vitest.setup.ts` manages the server lifecycle globally:

```ts
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers()) // clears per-test overrides
afterAll(() => server.close())
```

No per-file server setup is needed. Override a handler for a single test by calling `server.use(...)` inside the test body — it is reset automatically after the test.

---

### 1. Unit tests

#### Validators (`validation.test.ts`)

Call each validator function directly. Cover: empty input, boundary values, valid input.

```ts
import { describe, expect, it } from 'vitest'
import { xxxFormValidate } from './validation'

describe('xxxFormValidate', () => {
  describe('field', () => {
    it('returns error when empty', () => {
      expect(xxxFormValidate.field('')).toBe('Required')
    })
    it('returns error when exceeds max length', () => {
      expect(xxxFormValidate.field('a'.repeat(201))).toBe('Max 200 characters')
    })
    it('returns null when valid', () => {
      expect(xxxFormValidate.field('value')).toBeNull()
    })
  })
})
```

#### Services with non-trivial logic (`service.test.ts`)

Only write direct service tests when the service contains logic worth isolating: data transformation, error mapping, retry behaviour, or cache decisions. Simple fetch-and-return services are already covered by integration tests (MSW) and E2E — a direct test would only re-assert that `fetch` was called, which has no value.

When a service does have logic, test it by providing a controlled MSW response and asserting on the returned value or thrown error:

```ts
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import { getXxxList } from './service'

describe('getXxxList', () => {
  it('maps API response to domain type', async () => {
    server.use(
      http.get('http://localhost:3333/xxx', () =>
        HttpResponse.json([{ id: '1', snake_case_field: 'value' }])
      )
    )
    const result = await getXxxList()
    expect(result[0].camelCaseField).toBe('value')
  })

  it('throws with message when API returns 500', async () => {
    server.use(
      http.get('http://localhost:3333/xxx', () =>
        HttpResponse.json({ message: 'DB unavailable' }, { status: 500 })
      )
    )
    await expect(getXxxList()).rejects.toThrow('DB unavailable')
  })
})
```

---

### 2. Integration tests (`routes/<feature>-*.test.tsx`)

One test file per route component. Wrap the component with `MantineProvider`, `QueryClientProvider`, and `Suspense`. Two mocks are required at the top of every list test file:

1. `@tanstack/react-router` — navigation/params (no real router in tests)
2. `../../../lib/authentication` — `authClient.useSession()` must return a fake user so `useAuth` calls `GET /me/permissions`; without this, `HasPermission` always hides its children

Use the generated factories and handlers from `@helix/api-client/mocks` — never write raw `http.get(...)` / `HttpResponse.json(...)` MSW calls in route tests:

```tsx
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@helix/ui'
import {
  createXxx,
  deleteXxxIdHandler,
  deleteXxxIdHandlerResponse204,
  getMePermissionsHandler,
  getXxxHandler,
  postXxxHandler,
  postXxxHandlerResponse201,
  patchXxxIdHandler,
  patchXxxIdHandlerResponse200,
  patchXxxIdHandlerResponse404,
} from '@helix/api-client/mocks'
import { server } from '../../../mocks/server'
import { XxxList } from './xxx-list'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  // Return pagination + sorting defaults so the list component renders without errors
  useSearch: () => ({ page: 1, pageSize: 10, sortOrder: 'desc' }),
  useParams: () => ({}),
}))

vi.mock('../../../lib/authentication', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: 'test-user',
          name: 'Test',
          email: 'test@example.com',
          image: null,
          roleId: 'test-role',
        },
      },
      isPending: false,
    }),
  },
}))

const mockItems = [
  createXxx({ id: '1', title: 'Item one' }),
  createXxx({ id: '2', title: 'Item two' }),
]

function renderXxxList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <XxxList />
          </Suspense>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getXxxHandler(mockItems),
    getMePermissionsHandler({
      grants: { xxx: ['view', 'create', 'edit', 'delete'] },
    })
  )
})

afterEach(() => vi.clearAllMocks())
```

**Factory naming convention**: prefer the named entity factory (`createTodo`, `createRole`, `createUser`, `createAuditLog`) — these exist for every module whose schema has `.meta({ id })` in the API. The operation-specific factories (`createGetRolesId200`, `createGetUsersId200`, etc.) are thin wrappers that just delegate to the named factory; use the named version directly for clarity.

**List fixtures**: always build the array manually from single-item factories — do not use `createGetXxx200([...])`, which prepends random faker items to the given array.

When you need to test that action buttons are hidden when the user lacks a permission, override `getMePermissionsHandler` inside that test:

```ts
it('hides edit and delete buttons when user lacks permissions', async () => {
  server.use(getMePermissionsHandler({ grants: { xxx: ['view'] } }))
  renderXxxList()
  await screen.findByText('Item one')
  expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument()
})
```

**Response helpers** — every generated handler ships with typed response helpers for each status code it can return. Always use these instead of constructing raw `Response`/`HttpResponse` objects — they encode the correct status, headers, and body shape:

```ts
// GET list — pass data directly (no response helper needed for lists)
server.use(getXxxHandler(mockItems))

// GET item — handler accepts data directly
server.use(getXxxIdHandler(createXxx({ id: '1' })))

// POST — use the 201 helper
server.use(postXxxHandler(() => postXxxHandlerResponse201(createXxx())))

// PATCH — use the 200 or 404 helper
server.use(
  patchXxxIdHandler(async (info) => {
    const body = await info.request.json()
    return patchXxxIdHandlerResponse200({ ...createXxx(), ...body })
  })
)

// DELETE — use the 204 helper (no body needed)
server.use(deleteXxxIdHandler(() => deleteXxxIdHandlerResponse204()))
```

The only case for raw `Response` is status codes the spec doesn't define (e.g. 500 server errors in error-path tests):

```ts
server.use(
  postXxxHandler(
    () =>
      new Response(JSON.stringify({ message: 'Server error' }), {
        status: 500,
      })
  )
)
```

**Capturing DELETE calls** — pass a function to the handler and use the generated 204 helper:

```ts
let deletedId: string | undefined
server.use(
  deleteXxxIdHandler(({ params }) => {
    deletedId = params.id as string
    return deleteXxxIdHandlerResponse204()
  })
)
```

**What to cover per screen:**

| Screen | Tests                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List   | renders items; status badges; clicking Delete opens confirm dialog; confirming calls DELETE endpoint; cancelling closes dialog; hides Edit/Delete when user lacks permission |
| Create | renders form; validation errors on empty submit; POST called with correct payload + navigates on success; shows danger notification on API error                             |
| Edit   | form pre-populated from GET response; validation errors; PATCH called with updated payload + navigates on success; shows danger notification on API error                    |
| Detail | renders all fields; correct badge per status                                                                                                                                 |

**Key patterns:**

- Use `await screen.findByText(...)` for content behind Suspense
- **Use `await screen.findAllByLabelText("Delete")` (async) instead of `screen.getAllByLabelText("Delete")` (sync)** when clicking permission-gated buttons. The permissions query resolves after the data query — by the time `findByText` resolves, `HasPermission` may not have re-rendered yet.
- Scope modal assertions with `await screen.findByRole("dialog")` — Mantine modals render in portals
- Use `waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())` to assert a modal closed
- Capture request bodies in MSW handlers to verify payloads without spying on service functions
- For routes that read a param (`useParams`), add it to the router mock: `useParams: () => ({ id: "1" })`
- **Create and Edit test files must mock `useBlocker`** — `Form` from `@helix/ui` calls `useFormBlocker` → `useBlocker` from `@tanstack/react-router`, which requires a `RouterProvider` context that is not present in unit tests. Use `importOriginal` to keep all other exports intact:

```ts
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})
```

This is safe to combine with `vi.mock('.')` (the local route index mock) because `@tanstack/react-router` is an external package and does not trigger the circular dependency that makes the local mock necessary.

**When to add a new endpoint to `src/mocks/handlers.ts`**: every new API endpoint needs a default handler. Follow the pattern below — use generated response helpers for all status codes, never construct raw `Response` objects:

```ts
// GET list (paginated) — pass a PaginatedXxx object, not a plain array
getXxxHandler(createPaginatedXxx({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 })),
// GET item — default to 404
getXxxIdHandler(() => getXxxIdHandlerResponse404({ message: "Not found" })),
// POST — return a valid created entity
postXxxHandler(() => postXxxHandlerResponse201(createXxx())),
// PATCH — default to 404
patchXxxIdHandler(() => patchXxxIdHandlerResponse404({ message: "Not found" })),
// DELETE — 204 with no body
deleteXxxIdHandler(() => deleteXxxIdHandlerResponse204()),
```

In test files, override the list handler with actual fixture data:

```ts
const mockItems = [
  createXxx({ id: '1', title: 'Item one' }),
  createXxx({ id: '2' }),
]

server.use(
  getXxxHandler(
    createPaginatedXxx({
      data: mockItems,
      total: mockItems.length,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
  )
)
```

The default for `GET /me/permissions` already returns `{ grants: {} }` — test files override this in `beforeEach` with the grants their module needs.

---

### 3. E2E tests (`e2e/<feature>.spec.ts`)

Tests run against the real dev server and real backend. All tests are pre-authenticated via Playwright's `storageState` (session saved by `e2e/auth.setup.ts` before the suite runs).

**Each test must be self-contained** — create any data it needs via the UI and do not rely on pre-existing database state.

```ts
import { expect, test, type Page } from '@playwright/test'

async function createXxx(page: Page, title: string) {
  await page.goto('/xxx/create')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL('/xxx')
}

test.describe('Xxx', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/xxx')
  })

  test('displays the list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Xxx' })).toBeVisible()
  })

  test('creates a new item and shows it in the list', async ({ page }) => {
    await createXxx(page, 'My item')
    await expect(page.getByRole('cell', { name: 'My item' })).toBeVisible()
  })
})
```

Use `getByRole`, `getByLabel`, and row-scoped locators (`page.getByRole("row", { name: /.../ }).getByLabel("Edit")`) to keep selectors resilient to layout changes.

**Auth E2E** (`e2e/auth.spec.ts`) overrides the storageState to run unauthenticated:

```ts
test.use({ storageState: { cookies: [], origins: [] } })
```
