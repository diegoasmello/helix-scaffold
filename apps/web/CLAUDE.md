# apps/web

React 19 + Vite — the main application.

## Stack

- **UI**: Mantine v9 + `@mantine/emotion` (Emotion-based CSS-in-JS)
- **Routing**: TanStack Router v1 (code-based, not file-based)
- **Data fetching**: TanStack Query v5
- **Forms**: `@mantine/form`
- **Icons**: Tabler Icons (`@tabler/icons-react`)
- **API client**: generated hooks/fetchers/types/mocks from `@helix/api-client` (see `packages/api-client/CLAUDE.md`)
- **Auth client**: `better-auth/react` (`src/lib/authentication.ts`)

`@/` is an alias for `apps/web/src` (Vite and Vitest). `src/env.ts` validates `import.meta.env` with Zod — `VITE_API_URL` is the only variable.

## App config (`src/config/`)

| File | Holds |
| --- | --- |
| `app.ts` | `appConfig`: product name (browser tab title) and i18n languages + default language |
| `sidebar.ts` | Navigation groups, items and their permissions; `canSeeSidebarItem()` / `findHomeSidebarItem()` (visibility and the `/` landing page) |
| `theme.ts` | Mantine theme via `createTheme()` |

`appConfig.name` and `appConfig.i18n.defaultLanguage` are injected into `index.html` (`%APP_NAME%`, `%APP_LANG%`) by a small plugin in `vite.config.ts`, so `src/config/app.ts` must stay free of browser-only imports (it is also in `tsconfig.node.json`).

**Never put behaviour settings here.** Registration mode, social providers and subscriptions come from the API at runtime (`GET /registration/status`, `GET /subscription/status`) — configure them in `apps/api/src/app.config.ts`. The only env var is `VITE_API_URL` (per-deploy).

## Routing pattern

Routes are defined in code (not files). The flow is:

1. `src/routes.ts` — root of the route tree; assembles all routes
2. Each feature module exports its routes as **named constants** from `routes/index.ts` — never use a factory function pattern
3. Authenticated routes are children of the `authenticatedRoute`, which renders `AuthGuard`

To add a new feature module, create `src/modules/<feature>/routes/index.ts` exporting each route as a named constant and a combined array (e.g. `xxxRoutes`), then register it in `routes.ts`.

### Route tree (`src/routes.ts`)

```
rootRoute (Outlet; notFoundComponent: NotFound, errorComponent: ErrorBoundary)
├── authRoutes — /bootstrap, /login, /sign-up, /forgot-password, /reset-password (public, no layout)
└── layoutRoute (id 'layout', renders <App /> — sidebar, header)
    ├── /403         → Forbidden (inside the layout, so the user can navigate away)
    └── authenticatedRoute (id 'authenticated', renders <AuthGuard />)
        ├── /        → redirects to the user's first visible sidebar page, else /me
        └── users, roles, audit, me, todos, subscriptions routes
```

`authenticatedRoute.beforeLoad` redirects to `/login` without a session, then puts two functions in the **router context** for every child route's `beforeLoad`:

- `context.hasPermission(resource, action)` — from `GET /me/permissions`, via `createPermissionChecker()` (the same function `useAuth()` uses)
- `context.hasSubscriptionAccess(feature?)` — from `GET /subscription/status` (+ `GET /me/entitlements` when enabled); see `src/modules/subscriptions/CLAUDE.md` → _Route guards_

Together they are the `AccessCheckers` that `guardPage()` reads — see _Route-level guards_.
- `context.subscriptionEnabled` — `subscriptions.enabled` from the same status

**The `/` redirect** uses them through `findHomeSidebarItem()` (`src/config/sidebar.ts`): the first item, in sidebar order, that `canSeeSidebarItem()` allows — the same function `app.tsx` filters the sidebar with, so `/` never lands on a page the sidebar hides (or on `/403`). With no visible item it goes to `/me`, which every signed-in user may open. Reordering `sidebarGroups` changes the landing page.

Both are loaded with `queryClient.ensureQueryData`, the same cache the `useAuth()` / `useSubscriptionAccess()` hooks read, so components make no extra requests. Route files import `queryClient` from `src/lib/query-client.ts` (a plain `new QueryClient()` — default `staleTime: 0`, so data refetches when a component mounts).

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

The auth layer lives in the `auth` module (`src/modules/auth/` — full reference in its `CLAUDE.md`):

- `useAuth()` (`src/modules/auth/use-auth.ts`) — returns `{ user, grants, isPending, isAuthenticated, hasPermission(resource, action) }`. Session from better-auth, grants from `GET /me/permissions` (cached 30 s).
- `HasPermission` (`src/modules/auth/components/has-permission.tsx`) — renders children only when the current user has the permission:

```tsx
import { HasPermission } from '../../auth/components/has-permission'
;<HasPermission resource="features" action="create">
  <Button onClick={() => navigate({ to: '/features/create' })}>{tc('actions.create')}</Button>
</HasPermission>
```

- `AuthGuard` (`src/modules/auth/components/auth-guard.tsx`) — component of `authenticatedRoute`; redirects to `/login` if the session ends mid-use.

### Route-level guards (`PageAccess` + `guardPage`)

What a page requires is declared **once**, as a `PageAccess` in the module's `routes/access.ts`, and enforced by `guardPage()` (`src/modules/auth/page-access.ts`) in the route's `beforeLoad`. Every protected route declares that `beforeLoad`:

```ts
// src/modules/xxx/routes/access.ts — imports nothing but the type, so src/config/sidebar.ts can import it
import type { PageAccess } from '@/modules/auth/page-access'

export const XXX_ACCESS = {
  view: { permission: { resource: 'xxx', action: 'view' } },     // list + detail
  create: { permission: { resource: 'xxx', action: 'create' } },
  edit: { permission: { resource: 'xxx', action: 'edit' } },
} satisfies Record<string, PageAccess>

// src/modules/xxx/routes/index.ts
const xxxListRoute = createRoute({
  // ...
  beforeLoad: guardPage(XXX_ACCESS.view),
})
```

`PageAccess` has three optional parts, checked in the API's order by `checkPageAccess()`:

| Field | Missing → |
| --- | --- |
| `requiresSubscriptions: true` — the page exists only while subscriptions are enabled | `/` |
| `feature: '<key>'` — the user's plan must include it (see `src/modules/subscriptions/CLAUDE.md`) | `/upgrade?feature=<key>` |
| `permission: { resource, action }` — the RBAC grant | `/403` |

Permission per route type:

| Route                  | Action   |
| ---------------------- | -------- |
| list (`/xxx`)          | `view`   |
| detail (`/xxx/$id`)    | `view`   |
| create (`/xxx/create`) | `create` |
| edit (`/xxx/$id/edit`) | `edit`   |

`guardPage()` reads `context.hasPermission`, `context.hasSubscriptionAccess` and `context.subscriptionEnabled` from `authenticatedRoute.beforeLoad` (see _Route tree_). Write a custom `beforeLoad` only for pages with their own rule (`/upgrade`, `/me/subscription`). **The sidebar uses the same constant** (`access: XXX_ACCESS.view` — see _Register the module_), and `src/routes.test.ts` checks against the real router that every sidebar item carries its route's access and that every authenticated page (except the ones open to every user: `/`, `/me/*`, `/upgrade`) is protected by `guardPage()`.

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

**Cross-module components** — components from one module consumed by another — always live in the **source module's** `components/`, not in the consuming module. Examples:

- `roles/components/role-select-field.tsx` — used by `users`, lives in `roles`
- `roles/components/role-create-drawer.tsx` — used by `users`, lives in `roles`

Never place a component in the consuming module just because it's used there. The source module owns it.

### Relational select fields with inline creation

When a `Select` field for a related entity needs to allow creating that entity inline (without leaving the form), follow this pattern:

**Files (both live in the source module):**

- `xxx-select-field.tsx` — the select component, accepts optional `allowCreate` prop
- `xxx-create-drawer.tsx` — the creation drawer, opened by the select when `allowCreate` is true

**Why a drawer, not a modal:** scales across modules regardless of form complexity — 2 fields or 10, the experience is consistent.

**Select field (`xxx-select-field.tsx`):**

```tsx
export type XxxSelectFieldProps = Omit<SelectProps, 'data'> & {
  allowCreate?: boolean
}

export function XxxSelectField(props: Readonly<XxxSelectFieldProps>) {
  const { allowCreate, onChange, className, ...selectProps } = props

  const { data: items } = useGetXxxAllSuspense()
  const { classes, cx } = useStyles()
  const [opened, { open, close }] = useDisclosure(false)

  const select = (
    <Select
      data={items.map((item) => ({ value: String(item.id), label: item.name }))}
      label="Xxx"
      placeholder="Pick one"
      searchable
      clearable
      onChange={onChange}
      className={allowCreate ? cx(classes.select, className) : className}
      {...selectProps}
    />
  )

  if (!allowCreate) return select

  return (
    <>
      <Stack align="flex-start" gap="xs">
        {select}
        <Tooltip label="Create xxx">
          <Button
            variant="default"
            leftSection={<IconPlus size={16} />}
            aria-label="Create xxx"
            onClick={open}
          >
            Create related xxx
          </Button>
        </Tooltip>
      </Stack>
      <XxxCreateDrawer
        opened={opened}
        onClose={close}
        onSuccess={(id) => onChange?.(id, { value: id, label: '' })}
      />
    </>
  )
}

const useStyles = createStyles(() => ({
  select: css`
    width: 100%;
  `,
}))
```

- Hooks (`useDisclosure`, `useStyles`) are always called — no conditional hook calls
- `className` from the caller is merged via `cx` with the internal `width: 100%` only when `allowCreate` is true
- `onSuccess` calls `onChange` with the new entity's ID so the field auto-selects the created entity; the `label` argument is empty because Mantine always resolves the displayed label from `data`, not from the `onChange` callback

**Creation drawer (`xxx-create-drawer.tsx`):**

```tsx
export interface XxxCreateDrawerProps {
  opened: boolean
  onClose: () => void
  onSuccess: (id: string) => void
}

export function XxxCreateDrawer(props: Readonly<XxxCreateDrawerProps>) {
  const { opened, onClose, onSuccess } = props

  const queryClient = useQueryClient()

  const { mutate: createXxx, isPending } = useMutation({
    mutationFn: (data: CreateXxxInput) => postXxx(data),
    onSuccess: () => {
      // Invalidate the /all query so the select refreshes after creation
      queryClient.invalidateQueries({ queryKey: getXxxAllSuspenseQueryKey() })
    },
  })

  const form = useForm<XxxFormValues>({
    initialValues: { name: '', /* other fields */ },
    validate: xxxFormValidate,
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  const handleSubmit = (values: XxxFormValues) => {
    createXxx(values, {
      onSuccess: (created) => {
        notify({ status: 'success', message: 'Xxx created successfully' })
        handleClose()
        onSuccess(created.id)
      },
      onError: () => {
        notify({ status: 'danger', message: 'Failed to create xxx' })
      },
    })
  }

  return (
    <Drawer opened={opened} onClose={handleClose} title="Create Xxx" position="right">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <XxxForm form={form} />
          <Group justify="flex-end">
            <Button size="md" variant="default" type="button" disabled={isPending} onClick={handleClose}>
              Cancel
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  )
}
```

- Uses a plain `<form>` (not `<Form>` from `@helix/ui`) — the `Form` wrapper is for full-page screens and brings navigation-blocking behaviour that is inappropriate inside a drawer
- `handleClose` resets the form before closing, so reopening the drawer always shows a blank form
- Cache invalidation is in `useMutation.onSuccess` (always fires); `notify` and `onSuccess(id)` are in `mutate`'s callback (fires only if the component is still mounted)

**Consuming module** — just add `allowCreate` to the existing field, no wrapper needed:

```tsx
<RoleSelectField allowCreate {...form.getInputProps('roleId')} />
```

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

- `src/config/theme.ts` — app-level Mantine theme: defines the `main` palette and sets it as `primaryColor`, via `createTheme()` from `@helix/ui`
- `packages/ui/src/theme/index.ts` — base theme: fonts (Geist + Plus Jakarta Sans), radius, component styles and a **custom spacing scale** (`xs` 8px, `sm` 12px, `md` 16px, `lg` 24px, `xl` 32px — not Mantine's defaults). See `packages/ui/CLAUDE.md` → _Theme_.

### Styling conventions

Same rules as `packages/ui` — the full reference is `packages/ui/CLAUDE.md` → _Styling conventions_. In short: `createStyles` + `useStyles`, never the `style` prop; declare only the `createStyles` parameters you use; theme tokens (`${theme.spacing.md}`, `${theme.colors.gray[6]}`), never raw `var(--mantine-*)`.

---

## File uploads

File upload fields are provided by `@helix/ui` as pure UI components. The actual HTTP call lives in `src/modules/uploads/service.ts` and is passed as the `onUpload` prop — keeping the UI components free of API dependencies.

### Components (from `@helix/ui`)

| Component | Use case |
|-----------|----------|
| `FilesInput` | Multiple files — dropzone + `SimpleGrid` of `FileCard`s |
| `FileInput` | Single file — compact dropzone that collapses into a `FileCard` |
| `FilePreview` | Read-only — download link wrapping a `FileCard`-style card; used in detail screens |

All three accept `label`, `description`, and `error` props and use `Input.Wrapper` internally, so their spacing matches native Mantine inputs exactly.

`FilesInput` and `FileInput` are generic over `T extends UploadedFile` — TypeScript infers `T` from the `value` prop, so passing `Upload` (from `@helix/api-client/types`) works without explicit type annotation.

### `uploadFile` service (`src/modules/uploads/service.ts`)

```ts
import { uploadFile } from '@/modules/uploads/service'
```

Wraps `POST /uploads` as a multipart request. Returns `Upload` from `@helix/api-client/types`. Pass it directly as `onUpload` to `FilesInput` or `FileInput`.

### Wiring a form field

```tsx
import { FilesInput, FileInput, IMAGE_MIME_TYPE, PDF_MIME_TYPE } from '@helix/ui'
import { uploadFile } from '@/modules/uploads/service'

// Multiple files
<FilesInput
  label="Attachments"
  description="Upload up to 10 files of any type"
  value={form.values.attachments}           // UploadItem[]
  onChange={(uploads) => form.setFieldValue('attachments', uploads)}
  onUpload={uploadFile}
  error={form.errors.attachments as string | undefined}
  maxFiles={10}
/>

// Single file
<FileInput
  label="Image"
  description="JPEG, PNG, WebP or GIF"
  value={form.values.image}                 // UploadItem | null
  onChange={(upload) => form.setFieldValue('image', upload)}
  onUpload={uploadFile}
  accept={IMAGE_MIME_TYPE}
  error={form.errors.image as string | undefined}
/>
```

### Mapping to the API on submit

The form holds full `UploadItem` objects for previewing. On submit, map them to IDs:

```ts
createXxx({
  // ...other fields
  attachmentIds: values.attachments.map((u) => u.id),
})
```

On edit, prefill from the API response:

```ts
initialValues: {
  // ...other fields
  attachments: item.attachments,   // UploadItem[] from API
}
```

### Detail screen

Use `FilePreview` from `@helix/ui` inside a `SimpleGrid`:

```tsx
{item.attachments.length > 0 && (
  <LabeledValue label="Attachments">
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
      {item.attachments.map((a) => (
        <FilePreview key={a.id} upload={a} />
      ))}
    </SimpleGrid>
  </LabeledValue>
)}
```

### Adding uploads to a new module

See `todos` as the reference implementation. The checklist:

1. Add `attachments: UploadItem[]` (and optionally `file`/`image: UploadItem | null`) to `XxxFormValues`
2. Add `attachments: []` (and `file: null`, `image: null`) to `useForm` `initialValues`
3. Drop `<FilesInput>` / `<FileInput>` into the form component with `onUpload={uploadFile}`
4. Map to `attachmentIds` (and `fileId`, `imageId`) on submit
5. Prefill from `item.attachments` on edit
6. Render `<FilePreview>` in the detail screen

---

## PDF export

Modules with a list screen can expose an Export PDF button that downloads a report respecting the current filters and sort order.

### `downloadReport` and `buildReportFilename` (`src/lib/download-report.ts`)

`downloadReport` is a generic fetch helper for binary downloads — do not write raw `fetch` calls inline.

`buildReportFilename(slug)` generates a consistent `{slug}-{YYYY-MM-DD}.pdf` filename. Always use it — never construct the filename inline.

```ts
import { downloadReport, buildReportFilename } from '@/lib/download-report'

// e.g. "features-2026-01-15.pdf" — date is computed at call time
buildReportFilename('features')
```

`downloadReport`:
- Filters out `undefined` params before building the query string
- Adds a 60-second `AbortController` timeout
- Throws with a descriptive message (`status + response body`) on non-2xx responses
- Creates an object URL, clicks a hidden `<a>` to trigger the download, then revokes the URL

### `useExportPdf` hook (`src/lib/use-export-pdf.ts`)

Encapsulates the loading state, `downloadReport` call, and success/error notifications. **Always use this hook — never inline the pattern manually.**

```ts
import { useExportPdf } from '@/lib/use-export-pdf'

const { isExporting, handleExport } = useExportPdf(
  '/features/export',                              // API path
  { sortBy, sortOrder, filters, filterLogic },     // params — undefined values are omitted
  'features',                                      // slug → buildReportFilename('features')
)
```

Pass the same `sortBy`, `sortOrder`, `filters`, and `filterLogic` values the list hook already uses — this guarantees the exported PDF matches exactly what the user sees on screen.

### Wiring an Export button

```tsx
const { isExporting, handleExport } = useExportPdf(
  '/features/export',
  { sortBy, sortOrder, filters, filterLogic },
  'features',
)
```

Place the button in `PageList`'s `actions` prop, between the Filters button and the Create button:

```tsx
<Button
  variant="default"
  leftSection={<IconDownload size={16} />}
  loading={isExporting}
  onClick={handleExport}
>
  Export PDF
</Button>
```

### Testing

Mock `downloadReport` with `importOriginal` so `buildReportFilename` keeps its real implementation:

```ts
const mockDownloadReport = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/lib/download-report', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/download-report')>()
  return { ...actual, downloadReport: mockDownloadReport }
})
```

Assert the call with a regex for the filename so tests don't depend on today's date:

```ts
expect(mockDownloadReport).toHaveBeenCalledWith(
  '/features/export',
  expect.objectContaining({ sortOrder: 'desc' }),
  expect.stringMatching(/^features-\d{4}-\d{2}-\d{2}\.pdf$/),
)
```

### Reference implementation

`apps/web/src/modules/todos/routes/todos-list.tsx` — `useExportPdf` and the Export PDF button.  
`apps/web/src/lib/download-report.ts` — `downloadReport` and `buildReportFilename`.  
`apps/web/src/lib/use-export-pdf.ts` — `useExportPdf` hook.

---

## Internationalization (i18n)

The app uses **react-i18next** with all translations bundled (no lazy loading). TypeScript key safety is enforced via `CustomTypeOptions` declaration merging in `src/i18n/types.d.ts`. The active language is persisted by `i18next-browser-languagedetector` (localStorage + `navigator.language`).

### Architecture

```
src/i18n/
  index.ts          # i18next init — imports all locale files and registers them
  types.d.ts        # CustomTypeOptions — gives TypeScript literal key unions per namespace
  locales/
    en/             # English (source of truth for types.d.ts)
      common.json        # shared: nav labels, action buttons, report toasts
      auth.json          # login, sign-up, forgot/reset-password, bootstrap, social providers
      todos.json
      users.json
      roles.json         # includes the permission editor (permissions.*)
      audit.json
      me.json
      subscription.json  # admin screens, /me/subscription (me.*), /upgrade, plan feature labels (features.*)
      errors.json        # 403, 404, error boundary
    pt-BR/          # Portuguese — must have identical key structure to en/
      (same files)
```

**Supported languages** are declared in `appConfig.i18n.languages` (`src/config/app.ts`), which feeds both `supportedLngs` and the `LanguagePicker` options. To add a language: add it to that list, create `locales/<code>/` with every namespace, register it under `resources` in `i18n/index.ts`, and add `packages/ui/src/i18n/locales/<code>.json`.

**One namespace per module.** The `common` namespace owns strings shared across all modules: action button labels (`actions.save`, `actions.delete`, …), nav labels (`nav.todos`, …), and report toasts (`report.downloaded`, …). Validator messages are not here — they live in the `ui` namespace (see below).

### Using translations in components

```tsx
import { useTranslation } from 'react-i18next'

export function TodoList() {
  const { t } = useTranslation('todos')   // ← module namespace

  return <PageList title={t('title')} ... />
}
```

When a module screen needs a string from `common` (e.g. an action button label), pass `{ ns: 'common' }` explicitly — never duplicate those strings in the module namespace:

```tsx
// ✅ correct — reuse common strings
t('actions.delete', { ns: 'common' })
t('actions.save', { ns: 'common' })

// ❌ wrong — duplicating in module namespace
t('deleteLabel')  // with "deleteLabel": "Delete" in todos.json
```

If a single component needs strings from two namespaces, call `useTranslation` twice with different aliases:

```tsx
const { t } = useTranslation('todos')
const { t: tc } = useTranslation('common')
```

### packages/ui translations ('ui' namespace)

`packages/ui` components — filters, file upload, user menu, sidebar, confirm modal, rich text editor — are fully translated via a dedicated `'ui'` namespace that lives inside the package itself:

```
packages/ui/src/i18n/locales/
  en.json      # English — source of truth
  pt-BR.json   # Portuguese
```

These files are exposed as **subpath exports** (`@helix/ui/locales/en`, `@helix/ui/locales/pt-BR`) and registered by `apps/web/src/i18n/index.ts` at init time:

```ts
import uiLocaleEn   from '@helix/ui/locales/en'
import uiLocalePtBR from '@helix/ui/locales/pt-BR'

// registered as resources.en.ui and resources['pt-BR'].ui
```

`packages/ui` components call `useTranslation('ui')` on the shared singleton — no provider or sync needed. Language changes propagate automatically because both packages share the same i18next instance via `peerDependency`.

### Validator messages

`packages/ui` validator primitives (`required`, `email`, `maxLength`, etc.) call `i18n.t()` directly on the shared singleton with `{ ns: 'ui' }`. Their strings live in `packages/ui/src/i18n/locales/en.json` and `pt-BR.json` under `validation.*` — **not** in `common.json`. No setup is required in `apps/web`: registering the `'ui'` namespace in `i18n/index.ts` is sufficient.

### Cross-field validators with singleton i18n.t

Form-level cross-field validators (e.g. "passwords must match") cannot use `useTranslation` because they run outside React. Use the singleton `i18n.t()` directly, importing from the configured instance — not from bare `'i18next'`:

```ts
// ✅ correct — imports the configured, initialised instance
import i18n from '../../i18n'

export const passwordFormValidate = createValidator<PasswordFormValues>()({
  confirmPassword: (v, values) =>
    v !== values.newPassword
      ? i18n.t('security.validation.passwordsNoMatch', { ns: 'me' })
      : null,
})

// ❌ wrong — bare i18next singleton is the same object at runtime but the import
//    is opaque: it doesn't make the initialisation dependency explicit
import i18n from 'i18next'
```

### Breadcrumb labels

`staticData.breadcrumbs` in route definitions stores labels as i18n **keys** (e.g. `'nav.todos'`, `'actions.create'`). The `Header` component in `packages/ui` translates them reactively via `useTranslation('common')` at render time. Never call `t()` inside `staticData` — it is evaluated once at module load and the result would be frozen in the startup language. See _Step 5 — Breadcrumb convention_ in _Creating a new module_ for the full key reference.

### Sidebar labels

`src/config/sidebar.ts` stores sidebar item labels as i18n **keys** (e.g. `'nav.todos'`), not translated strings. `app.tsx` resolves them at render time via `useTranslation('common')`. When adding a sidebar entry for a new module:

1. Add the key to `common.json` (and `pt-BR/common.json`) under `nav.*`
2. Use the key string as the `label` in `sidebar.ts` — it will be translated automatically

### Adding translations for a new module

Follow these steps every time a new module is created:

**Step 1 — Create locale files**

`apps/web/src/i18n/locales/en/<module>.json`:

```json
{
  "title": "Features",
  "create": { "title": "Create Feature" },
  "edit":   { "title": "Edit Feature" },
  "detail": { "title": "View Feature" },
  "empty": {
    "title": "No features yet",
    "description": "Get started by creating your first feature.",
    "createButton": "Create first feature"
  },
  "columns": { "name": "Name", "status": "Status", "actions": "Actions" },
  "filters": { "name": "Name", "status": "Status" },
  "form": {
    "name": { "label": "Name", "placeholder": "Feature name" }
  },
  "labels": { "name": "Name", "createdAt": "Created At" },
  "status": { "active": "Active", "archived": "Archived" },
  "delete": {
    "title": "Delete feature",
    "message": "Are you sure you want to delete \"{{name}}\"? This action cannot be undone."
  },
  "notifications": {
    "created": "Feature created successfully",
    "createFailed": "Failed to create feature",
    "updated": "Feature updated successfully",
    "updateFailed": "Failed to update feature",
    "deleted": "Feature deleted successfully",
    "deleteFailed": "Failed to delete feature"
  }
}
```

Mirror the exact same key structure in `apps/web/src/i18n/locales/pt-BR/<module>.json` with Portuguese translations. **Key parity is mandatory** — a key present in `en` but absent in `pt-BR` will silently fall back to English; a key absent in both will render the raw key string.

**Step 2 — Register in i18n/index.ts**

```ts
// import
import featureEn   from './locales/en/feature.json'
import featurePtBR from './locales/pt-BR/feature.json'

// register under resources
resources: {
  en:    { ..., feature: featureEn   },
  'pt-BR': { ..., feature: featurePtBR },
}
```

**Step 3 — Add to types.d.ts**

```ts
import type feature from './locales/en/feature.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      // ...existing
      feature: typeof feature
    }
  }
}
```

**Step 4 — Use in components**

```tsx
const { t } = useTranslation('feature')
```

**Step 5 — Add sidebar nav key**

In `common.json` and `pt-BR/common.json`, add under `nav`:

```json
{ "nav": { "features": "Features" } }
```

In `sidebar.ts`, set `label: 'nav.features'`.

### TypeScript key safety

`types.d.ts` makes `t('nonExistentKey')` a compile error. When you use dynamic string keys (e.g. translating an array of labels built at runtime), TypeScript cannot verify them statically. The workaround is a local cast:

```ts
const { t: tRaw } = useTranslation('common')
const t = tRaw as (key: string) => string   // use only for truly dynamic keys
```

Never apply this cast globally — only where unavoidable (e.g. `app.tsx` sidebar translation, filter field labels).

### i18n in tests

`vitest.setup.ts` initialises i18n with a single side-effect import before every test file runs. All namespaces — including `'ui'` — are registered automatically. Tests assert against English strings (`fallbackLng: 'en'` is always active in jsdom). No per-test setup is needed.

**Critical — subpath alias ordering in `vitest.config.ts`**: the `@helix/ui/locales/*` aliases must appear **before** the catch-all `@helix/ui` alias, or the resolver will match the wrong entry:

```ts
alias: {
  '@helix/ui/locales/en':    resolve(__dirname, '../../packages/ui/src/i18n/locales/en.json'),
  '@helix/ui/locales/pt-BR': resolve(__dirname, '../../packages/ui/src/i18n/locales/pt-BR.json'),
  '@helix/ui':               resolve(__dirname, '__mocks__/@helix/ui.tsx'),  // catch-all last
}
```

**Why the subpath import matters**: `i18n/index.ts` imports `@helix/ui/locales/en` (just the JSON) rather than `@helix/ui` (the full barrel). Loading the full barrel in the test setup would transitively load `use-form-blocker.ts`, which captures `useBlocker` from `@tanstack/react-router` before `vi.mock()` in test files can intercept it — breaking all Create/Edit screen tests. The subpath avoids this entirely.

When a test file mocks `@tanstack/react-router` (required for Create/Edit screens that render `<Form>`), always use `importOriginal` to preserve all other exports:

```ts
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})
```

### New module i18n delivery checklist

Before marking any new module as complete, verify:

- [ ] `locales/en/<module>.json` exists with all keys (titles, columns, filters, form labels, placeholders, status labels, delete confirmation, notifications — including `deleteFailed`)
- [ ] `locales/pt-BR/<module>.json` exists with identical key structure
- [ ] Both files registered in `i18n/index.ts` (`resources.en` and `resources['pt-BR']`)
- [ ] Namespace added to `types.d.ts` (`CustomTypeOptions.resources`)
- [ ] Nav label key added to `common.json` and `pt-BR/common.json` under `nav.*`
- [ ] All route/component files use `useTranslation('<module>')` — no hardcoded strings remain
- [ ] Common action strings (`actions.save`, `actions.delete`, etc.) use `{ ns: 'common' }` — not duplicated in the module namespace
- [ ] `pnpm --filter web type-check` passes (catches missing/misspelled keys)
- [ ] `pnpm --filter web test` passes (validator messages resolve to English strings via `fallbackLng`)

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

// Create — invalidates the list. No params and NO `exact: true`: the key
// without params is the prefix of every cached page (page/sort/filters).
const queryClient = useQueryClient()
const { mutate: createXxx } = useMutation({
  mutationFn: (data: CreateXxxInput) => postXxxs(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: getXxxsSuspenseQueryKey() })
  },
})

// Update — invalidates the list and updates the item cache
const { mutate: updateXxx } = useMutation({
  mutationFn: ({ id, data }: { id: string; data: UpdateXxxInput }) =>
    patchXxxsId(id, data),
  onSuccess: (updated) => {
    queryClient.invalidateQueries({ queryKey: getXxxsSuspenseQueryKey() })
    queryClient.setQueryData(getXxxsIdSuspenseQueryKey(updated.id), updated)
  },
})

// Delete — invalidates the list and removes the item from cache
const { mutate: deleteXxx } = useMutation({
  mutationFn: (id: string) => deleteXxxsId(id),
  onSuccess: (_, id) => {
    queryClient.invalidateQueries({ queryKey: getXxxsSuspenseQueryKey() })
    queryClient.removeQueries({ queryKey: getXxxsIdSuspenseQueryKey(id) })
  },
})
```

**Separation of concerns in mutations:**

- `useMutation` (`onSuccess`) — reserved for cache operations (invalidation, `setQueryData`, `removeQueries`). Always fires, even if the component has unmounted.
- `mutate(data, { onSuccess, onError })` — component-dependent side effects: `notify()` and `navigate()`. Only fires if the component is still mounted. **Always declare both `onSuccess` and `onError` with `notify()`** in this scenario. When the API returns a meaningful error status (e.g. 409), branch on `error instanceof ApiError && error.status === 409` (`ApiError` from `@helix/api-client`) to show a specific translated message — never display the API's raw English `error.message`.

```ts
const { t } = useTranslation('xxx')

createXxx(data, {
  onSuccess: () => {
    notify({ status: 'success', message: t('notifications.created') })
    navigate({ to: '/xxx' })
  },
  onError: () => {
    notify({ status: 'danger', message: t('notifications.createFailed') })
  },
})

updateXxx(
  { id, data },
  {
    onSuccess: () => {
      notify({ status: 'success', message: t('notifications.updated') })
      navigate({ to: '/xxx' })
    },
    onError: () => {
      notify({ status: 'danger', message: t('notifications.updateFailed') })
    },
  }
)

deleteXxx(id, {
  onSuccess: () => {
    notify({ status: 'success', message: t('notifications.deleted') })
  },
  onError: () => {
    notify({ status: 'danger', message: t('notifications.deleteFailed') })
  },
})
```

Code samples elsewhere in this file may show English literals for brevity — real components always go through `t()` (see _Internationalization_).

**When to create `hooks.ts`** — only in two cases:

1. The same mutation with the same invalidation logic is used in 2 or more components
2. The invalidation logic is complex: optimistic updates, rollback, conditional invalidation

Outside these cases, keeping the mutation inline is preferable — avoids indirection without real benefit.

### 4. Routes (`routes/index.ts`)

Export each route as a named constant and collect them in a combined array. **Never use a factory function** — `getParentRoute` receives `authenticatedRoute` directly:

```ts
import { z } from 'zod'
import { createRoute } from '@tanstack/react-router'
import { guardPage } from '@/modules/auth/page-access'
import { authenticatedRoute } from '@/routes'
import { XXX_ACCESS } from './access'

export const xxxListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/xxx',
  component: XxxList,
  pendingComponent: XxxPending,
  staticData: { breadcrumbs: [{ label: 'Xxx' }] },
  beforeLoad: guardPage(XXX_ACCESS.view),
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
- `beforeLoad` — `guardPage(XXX_ACCESS.<page>)` (see below)
- `loader` — call `queryClient.ensureQueryData(...)` for required data; fire-and-forget for secondary data (lookups, select options)

The list route additionally requires `validateSearch` and `loaderDeps` — without `loaderDeps`, TanStack Router won't re-run the loader when only the search params change.

For item routes (`$id`, `$id/edit`), the loader returns the item so the breadcrumb function receives it as `loaderData`.

**Access guard** — declare the module's `PageAccess` constants in `routes/access.ts` and give every route `beforeLoad: guardPage(...)` — see _Auth_ → _Route-level guards_:

```ts
import { guardPage } from '@/modules/auth/page-access'

import { XXX_ACCESS } from './access'

const xxxListRoute = createRoute({ /* ... */ beforeLoad: guardPage(XXX_ACCESS.view) })
const xxxCreateRoute = createRoute({ /* ... */ beforeLoad: guardPage(XXX_ACCESS.create) })
const xxxDetailRoute = createRoute({ /* ... */ beforeLoad: guardPage(XXX_ACCESS.view) })
const xxxEditRoute = createRoute({ /* ... */ beforeLoad: guardPage(XXX_ACCESS.edit) })
```

Use the same resource string registered in `apps/api/src/config/permissions.ts`.

### 5. Breadcrumb convention

Breadcrumb `label` values are **i18n keys**, not translated strings. The `Header` component (`packages/ui`) calls `useTranslation('common')` and resolves each label at render time via `t(label, { defaultValue: label })`. This makes breadcrumbs reactive to language changes — switching language re-renders the Header with the correct translations.

Do **not** call `t()` inside `staticData`. `staticData` is evaluated once at module load, outside React, so any string baked in there would be frozen in the language active at startup and would never update.

Dynamic labels (e.g. `#${item.id}`) are passed through untranslated because `t()` falls back to `defaultValue` when no matching key is found.

```ts
// List
staticData: {
  breadcrumbs: [{ label: 'nav.xxx' }]
}

// Create
staticData: {
  breadcrumbs: [{ label: 'nav.xxx', to: '/xxx' }, { label: 'actions.create' }]
}

// Detail
staticData: {
  breadcrumbs: [
    { label: 'nav.xxx', to: '/xxx' },
    { label: 'actions.view' },
    (data) => ({ label: `#${(data as XxxItem).id}` }),  // dynamic — not translated
  ]
}

// Edit
staticData: {
  breadcrumbs: [
    { label: 'nav.xxx', to: '/xxx' },
    { label: 'actions.edit' },
    (data) => ({ label: `#${(data as XxxItem).id}` }),  // dynamic — not translated
  ]
}
```

The keys `actions.create`, `actions.edit`, `actions.view` already exist in `common.json` — do not add module-specific duplicates. The module nav key (`nav.xxx`) must be added to `common.json` and `pt-BR/common.json` when the module is created (covered in the i18n checklist above).

### 6. Screen components

Use the page wrapper components from `@helix/ui`:

| Screen | Wrapper      | Key props                                                                      |
| ------ | ------------ | ------------------------------------------------------------------------------ |
| List   | `PageList`   | `title`, `actions` (Create button)                                             |
| Create | `PageCreate` | `title`, `children` (form fields), `footerActions` (Cancel + Save)             |
| Edit   | `PageEdit`   | `title`, `children` (form fields), `footerActions` (Cancel + Save)             |
| Detail | `PageView`   | `title` (item name), `footerActions` (Back button), `children` (LabeledValues) |

**Footer button conventions** — apply to every Create, Edit, and Detail screen:

- **Cancel / Back**: `size="md" variant="default"` — neutral action, never draws attention
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
  { accessor: "actions", title: "Actions", textAlign: "center", width: "1%", render: ... },
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

**Empty state** — every list screen must handle the case where there are no records and no active filters. In this case, render `EmptyState` from `@helix/ui` in place of the entire `PageList` (not just the `DataTable`). Include a direct call-to-action button so the user can create the first record without navigating back to find the Create button:

```tsx
if (xxxResponse.data.length === 0 && !filters) {
  return (
    <EmptyState
      title="No xxxs yet"
      description="Get started by creating your first xxx."
    >
      <Button
        size="lg"
        leftSection={<IconPlus size={16} />}
        onClick={() => navigate({ to: '/xxx/create' })}
      >
        Create first xxx
      </Button>
    </EmptyState>
  )
}

return (
  <PageList ...>
    ...
    <DataTable records={xxxResponse.data} ... />
  </PageList>
)
```

When active filters are present and the result is empty, skip the `EmptyState` — the `DataTable` handles that case with its own built-in empty message, which correctly signals "no results for these filters" rather than "nothing exists yet".

Form screens use the `<Form>` component from `@helix/ui` wrapping `PageCreate`/`PageEdit`. `Form` receives `form` (the `useForm` instance) and `onSubmit` (a plain function that receives the validated values — not `form.onSubmit(...)`). It handles validation and submission internally.

**Per-row action buttons** — use inline `Button size="xs" variant="default"` when a row has **≤ 3 actions**. When a row can have **> 3 actions**, use `<ActionsMenu>` from `@helix/ui` instead — it renders a dots trigger (`IconDots`) that opens a dropdown `Menu`.

**≤ 3 actions — inline buttons:**

```tsx
<Group gap="xs" wrap="nowrap">
  {/* View is always visible — reading the list already requires `features:view` */}
  <Button size="xs" variant="default" aria-label="View" onClick={() => navigate({ to: "/features/$id", params: { id: item.id } })}>
    View
  </Button>
  <HasPermission resource="features" action="edit">
    <Button size="xs" variant="default" aria-label="Edit" onClick={() => navigate({ to: "/features/$id/edit", params: { id: item.id } })}>
      Edit
    </Button>
  </HasPermission>
  <HasPermission resource="features" action="delete">
    <Button size="xs" variant="default" aria-label="Delete" onClick={() => handleDelete(item.id)}>
      Delete
    </Button>
  </HasPermission>
</Group>
```

**> 3 actions — dropdown menu:**

Use `hasPermission()` (from `useAuth()`) to filter the items array before passing it to `<ActionsMenu>` — do not pass hidden items. Destructive actions (e.g. Delete) get `color: 'red'`:

```tsx
const { hasPermission } = useAuth()

// Inside the column render:
const items: ActionsMenuItemConfig[] = [
  { label: tc('actions.view'), onClick: () => navigate({ to: '/features/$id', params: { id: item.id } }) },
  ...(hasPermission('features', 'edit') ? [{ label: tc('actions.edit'), onClick: () => navigate({ to: '/features/$id/edit', params: { id: item.id } }) }] : []),
  ...(hasPermission('features', 'delete') ? [{ label: tc('actions.delete'), color: 'red' as const, onClick: () => handleDelete(item.id) }] : []),
]
return <ActionsMenu items={items} />
```

`HasPermission` (the wrapper component) is replaced by `hasPermission()` (from `useAuth()`) in this pattern so the array can be filtered before passing to the component. The RBAC behaviour is identical — use `useAuth()` for both and import it from `../../auth/use-auth`.

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
        notify({ status: 'success', message: t('notifications.created') })
        navigate({ to: '/xxx' })
      },
      onError: () => {
        notify({ status: 'danger', message: t('notifications.createFailed') })
      },
    }
  )
}

return (
  <Form<XxxFormValues> form={form} onSubmit={handleSubmit}>
    <PageCreate title={t('create.title')} footerActions={<Group>...</Group>}>
      <XxxForm form={form} />
    </PageCreate>
  </Form>
)
```

```tsx
// xxx-edit.tsx — same shape with PageEdit
return (
  <Form<XxxFormValues> form={form} onSubmit={handleSubmit}>
    <PageEdit title={t('edit.title')} footerActions={<Group>...</Group>}>
      <XxxForm form={form} />
    </PageEdit>
  </Form>
)
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

- Every input — `TextInput`, `Textarea`, `Select`, `DateInput`, `RichTextEditor`, and select wrappers like `RoleSelectField`/`UserSelectField`: `{...form.getInputProps("field")}`. Do not bind `value`/`onChange`/`error` by hand.
- Switch/checkbox holding a boolean: `{...form.getInputProps("field", { type: "checkbox" })}`
- `DateInput` values are date strings (`DateStringValue`, e.g. `'2026-01-15'`), not `Date` — type the form field as `string | null` and never call `.toISOString()` on it.
- Exception — status toggles storing a domain value (e.g. `pending | completed`) in a `Switch`: bind `checked={form.values.status === 'completed'}` and set it with `form.setFieldValue`. Same for a `Select` whose value must be narrowed to a union type.

**Required fields**: every field that is required — statically or conditionally — must have the `required` prop on the Mantine input component. This renders the asterisk (`*`) indicator next to the label. Never rely on validation errors alone to signal obligation to the user.

```tsx
<TextInput
  label="Name"
  placeholder="Full name"
  required
  {...form.getInputProps('name')}
/>
```

For conditionally required fields, `required` must be conditional too — the asterisk should appear only when the field is actually required given the current state. Two common cases:

```tsx
// Field always visible, sometimes required
<TextInput
  label="Tax ID"
  required={form.values.entityType === 'company'}
  {...form.getInputProps('taxId')}
/>

// Field only rendered when required — required is always true when shown
{!isEditing && (
  <PasswordInput
    label="Password"
    required
    {...form.getInputProps('password')}
  />
)}
```

Validation lives in `validation.ts`. Use `createValidator<XxxFormValues>()({...})` — the curried form is necessary so TypeScript infers the schema shape while keeping `XxxFormValues` explicit:

```ts
import { createValidator, required, requiredHtml, maxLength } from '@helix/ui'
import type { XxxFormValues } from './types'

export const xxxFormValidate = createValidator<XxxFormValues>()({
  // array: validators run left-to-right, first error wins
  title: [required, maxLength(200)],

  // function: access other fields for cross-field rules
  date: (v, values) => (values.status !== 'pending' ? required(v) : null),

  // RichTextEditor fields must use requiredHtml (strips tags before checking)
  content: [requiredHtml, maxLength(1000)],
})
```

Available primitives: `required`, `requiredHtml`, `maxLength(n)`, `minLength(n)`, `minFiles(n)`, `email`. See `packages/ui/CLAUDE.md` → _Form validation utilities_ for the full reference.

### 9. Register the module

**`src/routes.ts`:**

```ts
import { xxxRoutes } from './modules/xxx/routes'
// add ...xxxRoutes to authenticatedRoute.addChildren([...])
```

**`src/config/sidebar.ts`:**

```ts
import { XXX_ACCESS } from '@/modules/xxx/routes/access'

{ label: 'nav.xxx', icon: IconXxx, to: '/xxx', access: XXX_ACCESS.view }
```

`access` must be the **same constant** the list route's `guardPage()` enforces — never a new object (`src/routes.test.ts` fails otherwise). `app.tsx` filters items with `canSeeSidebarItem()`, which is `checkPageAccess(item.access)` — the guard's own decision — so the sidebar never offers a page that would redirect. The first visible item is also where `/` sends the user.

### 10. Delete confirmation

Use `confirm()` from `@helix/ui` — no local state, no modal JSX:

```ts
import { confirm } from '@helix/ui'

const handleDelete = (item: XxxItem) => {
  confirm({
    status: 'danger',
    title: t('delete.title'),
    message: t('delete.message', { name: item.name }),
    confirmLabel: tc('actions.delete'),
    onConfirm: () => deleteXxx(item.id),
  })
}
```

The confirm button is automatically colored with `status: "danger"`. `onConfirm` is called when the user confirms — the modal closes automatically via `ModalsProvider`. Always pass `confirmLabel` explicitly (the Delete label) — the default label is `'Confirm'`, so omitting it produces a button that says "Confirm" instead of "Delete", which will break tests that assert `getByRole('button', { name: 'Delete' })`.

### 11. Tests

Every module ships with unit and integration tests — a module is only complete when both are covered. E2E specs are not part of the definition of done yet: no module has one (see _3. E2E tests_).

**Unit — `validation.test.ts`**

One `describe` per field. Cover: empty, boundary values, valid input.

**Integration — `routes/<feature>-list.test.tsx`, `routes/<feature>-create.test.tsx`, `routes/<feature>-edit.test.tsx`, `routes/<feature>-detail.test.tsx`**

Use MSW to control API responses. Add the module's endpoints to `src/mocks/handlers.ts` as default handlers, then override per test as needed. See the Testing section below for the full pattern and coverage table.

**E2E — `e2e/<feature>.spec.ts`** (only when asked)

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
| E2E         | Playwright         | Full CRUD flows against the real backend — infrastructure only, no specs yet   |

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

Call each validator function directly. Every call must pass a `base` values object as the second argument — `createValidator` types all fields as `(value, values) => string | null`, and cross-field validators require it at runtime.

Cover: empty input, boundary values, valid input. For cross-field fields, add cases for each condition branch.

```ts
import { describe, expect, it } from 'vitest'
import type { XxxFormValues } from './types'
import { xxxFormValidate } from './validation'

const base: XxxFormValues = {
  field: '',
  // ... all fields with safe defaults
}

describe('xxxFormValidate', () => {
  describe('field', () => {
    it('returns error when empty', () => {
      expect(xxxFormValidate.field('', base)).toBe('Required')
    })
    it('returns error when exceeds max length', () => {
      expect(xxxFormValidate.field('a'.repeat(201), base)).toBe('Max 200 characters')
    })
    it('returns null when valid', () => {
      expect(xxxFormValidate.field('value', base)).toBeNull()
    })
  })

  // Cross-field example:
  describe('date', () => {
    it('returns error when null and status is completed', () => {
      expect(xxxFormValidate.date(null, { ...base, status: 'completed' })).toBe('Required')
    })
    it('returns null when null and status is pending', () => {
      expect(xxxFormValidate.date(null, { ...base, status: 'pending' })).toBeNull()
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

One test file per route component. Wrap the component with `MantineProvider` (+ `MantineEmotionProvider` when anything uses `createStyles`), `ModalsProvider` when it opens `confirm()`, `QueryClientProvider` and `Suspense`. Two mocks are required at the top of every list test file:

1. `'.'` — the local route index. Components read `useNavigate`/`useSearch`/`useParams` from their own route constant (`xxxListRoute.useSearch()`), so mock that object. Do not mock those hooks on `@tanstack/react-router`: the component never imports them from there, and mocking the module the route index also imports creates a circular mock.
2. `../../../lib/authentication` — `authClient.useSession()` must return a fake user so `useAuth` calls `GET /me/permissions`; without this, `HasPermission` always hides its children

Use the generated factories and handlers from `@helix/api-client/mocks` — never write raw `http.get(...)` / `HttpResponse.json(...)` MSW calls in route tests:

```tsx
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineEmotionProvider, MantineProvider, ModalsProvider } from '@helix/ui'
import {
  createPaginatedXxx,
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

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  xxxListRoute: {
    useNavigate: () => mockNavigate,
    // Pagination + sorting defaults so the list component renders without errors
    useSearch: () => ({ page: 1, pageSize: 10, sortOrder: 'desc' }),
  },
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
      <MantineEmotionProvider>
        <ModalsProvider>
          <QueryClientProvider client={queryClient}>
            <Suspense fallback={<div>Loading...</div>}>
              <XxxList />
            </Suspense>
          </QueryClientProvider>
        </ModalsProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getXxxHandler(
      createPaginatedXxx({
        data: mockItems,
        total: mockItems.length,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      })
    ),
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
// GET list — pass the paginated object directly (not a plain array)
server.use(getXxxHandler(createPaginatedXxx({ data: mockItems, total: 2, page: 1, pageSize: 10, totalPages: 1 })))

// GET list whose content changes during the test (e.g. after a delete) — pass a function
server.use(getXxxHandler(() => getXxxHandlerResponse200(createPaginatedXxx({ data: items, /* … */ }))))

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
- For routes that read a param, add it to the route mock: `xxxDetailRoute: { useParams: () => ({ id: "1" }), useNavigate: () => mockNavigate }`
- To assert that a mutation refreshes the list, serve the list from a variable the mutation handler changes and wait for the row to disappear — see `users-list.test.tsx` → _refetches the list after deleting_
- **Create and Edit test files must mock `useBlocker`** — `Form` from `@helix/ui` calls `useFormBlocker` → `useBlocker` from `@tanstack/react-router`, which requires a `RouterProvider` context that is not present in unit tests. Use `importOriginal` to keep all other exports intact:

```ts
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})
```

This is safe to combine with `vi.mock('.')` (the local route index mock) because `@tanstack/react-router` is an external package and does not trigger the circular dependency that makes the local mock necessary.

**jsdom and Mantine gotchas**

These come up whenever a test renders real Mantine components instead of mocks:

- **Native `required` blocks a button-click submit.** In jsdom, clicking the submit button runs the browser's constraint validation first. An empty `required` input cancels the submit, so the Mantine validators never run and no error text appears. To test empty-field validation, submit the form element directly:

  ```ts
  const { container } = renderBootstrap()
  fireEvent.submit(container.querySelector('form')!)
  expect(await screen.findAllByText('Required')).toHaveLength(2)
  ```

  Inside a drawer or modal, scope it: `fireEvent.submit(dialog.querySelector('form')!)`. Clicking the button still works when every `required` field is filled, which is the case in submit-and-check-payload tests. Create/Edit tests that mock the form component (plain `<input>` without `required`) are not affected.

- **`Select` options are hidden.** The dropdown's open transition never finishes in jsdom, so its options stay out of the accessibility tree. Pass `hidden: true` to find and click them:

  ```ts
  await userEvent.click(await screen.findByPlaceholderText('Pick one'))
  await userEvent.click(
    await screen.findByRole('option', { name: 'Admin', hidden: true })
  )
  ```

  Typing in a `searchable` Select calls `scrollIntoView`, which jsdom lacks. `vitest.setup.ts` stubs it, alongside `matchMedia` and `ResizeObserver`.

- **i18n and the color scheme are global too.** A test that calls `i18n.changeLanguage(...)` or toggles dark mode changes them for every later test in the file. Restore them in `afterEach`:

  ```ts
  afterEach(async () => {
    await i18n.changeLanguage('en')
    localStorage.clear()
    document.documentElement.removeAttribute('data-mantine-color-scheme')
  })
  ```

- **The notifications store is global.** Notifications shown by `notify()` live in a module-level store that survives RTL's unmount between tests. A notification from one test is still there in the next, so `findByText` fails with "Found multiple elements". Every file that renders `<Notifications />` and asserts on notification text must clean the store:

  ```ts
  import { notifications } from '@helix/ui'

  afterEach(() => {
    vi.clearAllMocks()
    notifications.clean()
  })
  ```

- **`createStyles` needs `MantineEmotionProvider`.** Without it the component throws "Emotion cache is not available in context". This includes shared components that use it internally, such as `LabeledValue` (detail screens) and `RoleSelectField`. When in doubt, add the provider.

- **Asserting a loading state.** Make the request hang with MSW's `delay('infinite')`, then look for the Mantine loader:

  ```ts
  import { delay } from 'msw'

  server.use(
    getMeSubscriptionHandler(async () => {
      await delay('infinite')
      return getMeSubscriptionHandlerResponse204()
    })
  )
  const { container } = renderMeSubscription()
  expect(container.querySelector('.mantine-Loader-root')).toBeInTheDocument()
  ```

- **Testing `App` (`src/app.tsx`).** The real `Layout` renders `<Outlet />`, which needs a `RouterProvider`. `app.test.tsx` mocks `Layout` from `@helix/ui` (keeping all other exports through `importOriginal`) with a stub that renders the `sidebarGroups` as links plus buttons for `onAccountSettings` and `onLogout`. The test then asserts on what `App` computes, not on the layout's markup. Extend that stub instead of rendering the real layout.

**Mocking the shared form component in Create/Edit tests**

Create and Edit screens render a shared `XxxForm` component that contains Mantine inputs, `RichTextEditor`, and file upload fields — all hard to interact with in jsdom. Mock `XxxForm` with a simplified version that receives the real form instance:

```tsx
vi.mock('../components/xxx-form', () => ({
  XxxForm: ({ form }: { form: UseFormReturnType<XxxFormValues> }) => (
    <div>
      <input
        placeholder="Xxx title"
        value={form.values.title}
        onChange={(e) => form.setFieldValue('title', e.target.value)}
      />
      {form.errors.title && <span>{String(form.errors.title)}</span>}
      <input
        placeholder="Pick a date"
        value={form.values.date ?? ''}
        onChange={(e) => form.setFieldValue('date', e.target.value || null)}
      />
      {/* upload controls — let tests set required upload values */}
      <button
        type="button"
        data-testid="set-attachment"
        onClick={() => form.setFieldValue('attachments', [createUpload({ id: 'att-1' })])}
      >Set Attachment</button>
    </div>
  ),
}))
```

Rules:

- Type `form` as `UseFormReturnType<XxxFormValues>` — never use an inline structural type. Import `UseFormReturnType` from `@helix/ui`.
- Use `form.values.fieldName` directly for `string` fields — no `as string` casts. The form is fully typed.
- For `string | null` fields (e.g. `date`): `value={form.values.date ?? ''}` and `onChange={(e) => form.setFieldValue('date', e.target.value || null)}`.
- For upload fields (`UploadItem | null`, `UploadItem[]`): add `<button data-testid="set-xxx">` controls that call `form.setFieldValue` with a full `Upload` object. Use `createUpload` from `@helix/api-client/mocks` — never a bare `{ id: '...' }` (TypeScript rejects it because `Upload` has many required fields).
- `createUpload` must be called **inside the mock factory**, not assigned to a module-level `const` before `vi.mock`. Imports are hoisted alongside `vi.mock` and are accessible in the factory; module-level `const` declarations are not (they are in TDZ when the factory runs).

**Form component tests (`xxx-form.test.tsx`)**

Give the shared form component its own test file to verify that it renders the expected fields with correct labels and `required` attributes. The route tests mock this component, so without this file there is no integration test for its rendering.

```tsx
import { MantineEmotionProvider, MantineProvider, useForm } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { XxxFormValues } from '../types'
import { XxxForm } from './xxx-form'

const base: XxxFormValues = {
  title: '',
  // ... all fields with safe defaults
}

function FormWrapper() {
  const form = useForm<XxxFormValues>({ initialValues: base })
  return <XxxForm form={form} />
}

function renderForm() {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <FormWrapper />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

describe('XxxForm', () => {
  it('renders all field labels', () => {
    renderForm()
    expect(screen.getByText('Title')).toBeInTheDocument()
    // add one assertion per label
  })

  it('marks required fields', () => {
    renderForm()
    expect(screen.getByPlaceholderText('Xxx title')).toBeRequired()
    expect(screen.getByPlaceholderText('Xxx description')).toBeRequired()
  })
})
```

Rules:

- No `QueryClientProvider` or `Suspense` needed — the form component is purely presentational and makes no API calls.
- Use `getByPlaceholderText` to find native inputs (`TextInput`, `Textarea`, `DateInput`) and assert `toBeRequired()`. `getByLabelText` does not reliably resolve Mantine's `for`/`id` label association in jsdom.
- `toBeRequired()` only works on native HTML inputs/textareas — not on custom components (`FileInput`, `FilesInput`, `Switch`). Check those fields by asserting their label text is present instead.
- If the form has a field with conditional `required` (e.g. `date` required only when `status !== 'pending'`), parameterise `FormWrapper` with the relevant prop and add two tests — one per branch.
- `RichTextEditor` crashes its `Grid.Col` in jsdom because TipTap/ProseMirror initialises the editor synchronously and the instance is `null` before mount. Skip its label assertion and add a comment pointing to E2E coverage.

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

**Current state:** only the infrastructure exists — `playwright.config.ts` (starts `pnpm dev` or reuses it), and `e2e/auth.setup.ts`, which signs in with `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` from `apps/web/.env` (an existing user, e.g. the bootstrap admin) and saves the session to `e2e/.auth/user.json`. There are no specs yet; write them only when asked, following the pattern below.

Tests run against the real dev server and real backend. All tests are pre-authenticated via Playwright's `storageState`.

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

**Unauthenticated specs** (e.g. a future `e2e/auth.spec.ts`) override the storageState:

```ts
test.use({ storageState: { cookies: [], origins: [] } })
```
