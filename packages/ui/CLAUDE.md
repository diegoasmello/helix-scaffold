# packages/ui

Shared component library (`@helix/ui`). Private — not published to npm, consumed only by `apps/web` via `workspace:*`.

## Role

This package is the **single source of truth for all UI imports** in `apps/web`. It re-exports everything from Mantine, Tabler Icons, and clsx, so `apps/web` never imports those packages directly — only `@helix/ui`.

## Dependency model

UI framework packages (`@mantine/*`, `@emotion/react`, `@tabler/icons-react`, `clsx`, `dayjs`) are **direct dependencies** of this package. `apps/web` does not list them.

**Peer dependencies** (one shared instance with the app): `react`, `@tanstack/react-router` (the `AppRoute` type augmentation and `useBlocker` — see below), and `i18next` + `react-i18next` (components translate through the app's i18next singleton — see _Form validation utilities_).

The package ships TypeScript sources (`"exports": { ".": "./src/index.ts" }`) — there is no build step; `apps/web`'s Vite compiles it. It has no test runner of its own: its components are exercised by `apps/web` tests.

## What `src/index.ts` exports

```
side-effect imports  →  Mantine styles (core, dates, dropzone, tiptap, notifications),
                        mantine-datatable/styles.css, dayjs/locale/pt-br,
                        fonts (Geist, Plus Jakarta Sans), ./global.css
re-exports           →  @mantine/core, @mantine/hooks, @mantine/emotion, @mantine/dates,
                        @mantine/dropzone, @mantine/form, @mantine/modals,
                        @mantine/notifications, @tabler/icons-react, clsx
named export         →  css (from @emotion/react — only this function, not export *)
custom components    →  export * from "./components"
hooks                →  export * from "./hooks" (useFormBlocker, usePersistedSidebar)
utilities            →  export * from "./utils" (data-table helpers, validator primitives, createValidator, msg)
theme helper         →  createTheme (from ./theme)
locales              →  uiLocaleEn, uiLocalePtBR (also as subpath exports
                        @helix/ui/locales/en and @helix/ui/locales/pt-BR)
```

Name clashes resolved explicitly in `src/index.ts`:

- **`FileInput` is the custom upload field** (`components/file-upload/file-input.tsx`), not Mantine's. Mantine's file picker is re-exported as `MantineFileInput`.
- `CSSProperties` comes from `@mantine/core` (it also exists in `@mantine/emotion`).

## Adding a new component

1. Create `src/components/<name>/<name>.tsx`
2. Add `export * from "./<name>/<name>"` to `src/components/index.ts`

`src/index.ts` pulls everything from `src/components/index.ts` via `export * from "./components"` — never import individual component files from `src/index.ts` directly.

## Component groups

| Group          | Exports (folder)                                                        | Purpose |
| -------------- | ----------------------------------------------------------------------- | ------- |
| App shell      | `Layout`, `Header`, `HeaderSearch`, `NotificationsMenu`, `Sidebar`, `SidebarLinksGroup`, `UserMenu`, `Breadcrumb`, `RouteBreadcrumb` (`layout`, `header`, `sidebar`, `user-menu`, `breadcrumb`) | Full-page scaffold rendered by `apps/web` — see _App shell_ |
| Page wrappers  | `PageHeader`, `PageList`, `PageCreate`, `PageEdit`, `PageView`, `FormColumn`, `FormSection`, `PageTabs` (`page/`) | Standard CRUD screen layouts — see _Page layouts_; `PageHeader` (breadcrumb + `h1` + description + actions) tops all of them and custom pages |
| Data display   | `DataTable` (+ `useDataTableLayout`), `LabeledValue`, `EmptyState`, `StatusBadge` | Paginated/sortable table (no card: rounded outer border, header band + row borders — the pager sits outside the border; one card per record below `sm`, `cardTitleAside` puts a column such as the status next to the card's title; `emptyState` replaces the "no records" text in both layouts and is clickable; pagination is `DataTablePager` — "Showing 1–8 of 31", rows per page, "Page 1 of 4", Previous/Next, compact on phones); label + value pair — detail pages lay them out in a `Grid`; empty list screen with a CTA slot (nothing created yet); a record's state as a toned pill with a dot |
| Actions        | `RowActions` (+ `RowAction`), `ActionsMenu` (+ `ActionsMenuItemConfig`) | `RowActions` is every table row's actions: ≤ 3 visible → text buttons, more → one "⋯" menu; `danger`, `hidden`. `ActionsMenu` is a plain dots menu for other places |
| Forms          | `Form`, `useFormSummary`                                                | `<form>` wrapper: runs `form.onSubmit`, blocks navigation while dirty (`blockNavigationOnDirty`, default `true`), and tells the page around it whether it is dirty and how many fields have errors |
| File upload    | `FilesInput`, `FileInput`, `FilePreview`, `FileCard` (`file-upload/`)   | Multi/single upload fields (the HTTP call is injected via `onUpload`) and read-only previews. Files show as `FileTile` (thumbnail, or the extension — PDFs in red) + name + size; `FileInput` offers Replace/Remove, `FilesInput` lists its files in one bordered list under a dashed "Click to upload or drag files here" area with "N of M files uploaded" |
| Filtering      | `FilterBar`, `FilterPanel` (`filters/`)                                 | A list's filters: button + chips in words + all/any condition editor — see _Filters_ |
| Feedback       | `confirm()`, `notify()` (`modals/confirm`, `notifications/notify`)      | Confirm dialog helper; toast helper |
| Rich text      | `RichTextEditor`, `RichTextRenderer`                                    | Tiptap editor (HTML string value) and read-only renderer |
| Navigation     | `NavigationItem` (`navigation/`)                                        | Router-aware nav entry (the sidebar's) |
| Misc           | `LanguagePicker`                                                        | Language dropdown; options come from the `languages` prop |
| Theme          | `createTheme()` (`theme/index.ts`)                                      | Base theme — see _Theme_ |

## Theme (`src/theme/index.ts`)

`createTheme(overrides)` builds the base Mantine theme the app extends (`apps/web/src/config/theme.ts` adds the `main` palette and sets it as `primaryColor`):

- Fonts: **Geist Variable** for body and headings (headings weight 600; `h1` 30px with -0.025em tracking — the page title). Plus Jakarta Sans is still imported but no longer used.
- **Neutral palettes are zinc**: `gray` and `dark` replace Mantine's. Mantine reads them by index (`gray[6]` = light `dimmed`, 4.8:1 on white; `gray[4]` = input border; `dark[7]` = dark body; `dark[4]` = dark borders). The app's `colors` (e.g. `main`) are **merged** with these, not swapped in.
- **No shadows** — `shadows.*` are all `none`; surfaces are separated by 1px borders (`gray[3]` / `dark[5]`). `Paper` defaults to `withBorder` + `radius="lg"`. Never reintroduce a shadow for separation.
- Radius scale: `xs` 4, `sm` 6, `md` 8 (default), `lg` 12, `xl` 16.
- **`md` breakpoint is 1024px** (`64em`, not Mantine's 992px): below it the sidebar is a drawer and the header goes compact. In `createStyles`, write `@media (max-width: calc(${theme.breakpoints.md} - 0.0625em))` for "below md".
- **Custom spacing scale on a 4/8px grid** — it differs from Mantine's defaults, so pick values by size, not by habit: `xs` 8px, `sm` 12px, `md` 16px, `lg` 24px, `xl` 32px.
- Component defaults/styles for `Title`, `Input` (focus outline), `Button` (`variant="default"` + `color="red"` = the bordered destructive button, red text — Mantine itself ignores `color` on that variant), `Paper`, `Drawer`, `Modal` (bordered), `Menu`, `Badge` (light pill, not capitalized; `circle`/small sizes keep Mantine's geometry) and `Notification`.
- **It references `theme.colors.main`** (input focus ring, notification fallback), so any app using it must define a `main` palette.

## App shell

- **`Layout`** — `AppShell` with a 68px bordered header and a 272px sidebar (72px collapsed, persisted per user). Below `md` the sidebar renders in a `Drawer` instead (closes on navigation). Slots: `search`, `notifications`; `user` takes `{ name, description? }`.
- **`Sidebar`** — groups of items; each `SidebarItem` may carry a `badge` (`{ count, highlight? }`), an `action` (a "+" link, `{ label, to }` — `label` is its accessible name) and `links` (second level; a link's own `links` make a third). Sub-menus are tied to their parent by guide lines. Inside the drawer it gets `onClose` (close button instead of the collapse toggle).
- **`NavigationItem`** — the 44px entry used by the sidebar (active = white surface with a border). Props `size="nested"`, `badge`, `action`.
- **`HeaderSearch`** — pill input from `md` up (`Ctrl K` focuses it), an icon opening a dialog below; it only collects the query (`onSearch`).
- **`NotificationsMenu`** — bell with an unread count and a panel (`items`, `onItemClick`, `onMarkAllRead`, `onViewAll`); pure UI.
- **`RouteBreadcrumb`** — the breadcrumb built from the deepest route's `staticData.breadcrumbs` (labels are `common` keys). Renders nothing for a single crumb, or outside a router. `PageHeader` shows it unless `withBreadcrumb={false}` (create, edit and detail pages).
- **Page gutters** — `Layout`'s content area sets `--helix-page-px`/`--helix-page-pt`/`--helix-page-pb` (28/28/32px, 16/20/28px below `md`). Edge-to-edge pages cancel them with negative margins and reuse them as their inner padding; always read them with a fallback (`var(--helix-page-px, 0px)`) so the component still works outside `Layout` (tests).

## Page layouts

- **`PageList`** — `PageHeader` + the content (filters, `DataTable`) inside the page gutters. Below `sm` its header actions fill the width in equal columns (a `Group` around them is flattened with `display: contents`).
- **`PageCreate` / `PageEdit` / `PageView`** (all `PageSectionLayout`) — a header without breadcrumb (`title`, `description`, `titleAside`, `actions` that fill the width on phones), the content and `footerActions` in a bar stuck to the bottom of the screen (buttons fill the width on phones). There is no line between header and content, except when the page has `tabs` (a `PageTabs` at the bottom of the header, on its border). Inside a `Form` it adds the "Couldn't save. Fix the N highlighted fields below." alert after an invalid submit and "Unsaved changes" in the footer.
- **`FormColumn`** (`children`) — the fields of a short form in one column (max 720px, 18px gap). Plain content: it keeps the page padding.
- **`FormSection`** (`title`, `description?`, `children?`) — for longer forms whose fields fall into groups: a two-column group of fields (intro ≤ 300px left, fields ≤ 720px right, stacked when narrow). It carries `data-page-section`, is a `<section>` named by its `h2` (so `getByRole('region', { name })` finds it) and draws its own padding; content without sections keeps the page padding (`:has(> [data-page-section])`).
- **`PageTabs`** — `label` + `tabs: { label, to }[]`: route links as underlined tabs, `aria-current` on the active one, sideways scroll when they do not fit.

## Filters (`components/filters/`)

```ts
import {
  FilterBar,            // button + chips + panel — what list screens use
  FilterPanel,          // the editor alone
  type FilterFieldDef,  // { name, label, type, options? }
  type FilterFieldType, // 'text' | 'number' | 'boolean' | 'date' | 'select'
  type FilterCondition, // { field, op, value? } — what the API receives
  type FilterOperator,
  type LogicalFilterValue, // { conditions, logic: 'AND' | 'OR' }
} from '@helix/ui'
```

**`FilterBar`** (`fields`, `value`, `onChange`) — the "Filters" button (`light` with a count when conditions apply; accessible name "Filters, N applied"), one chip per applied condition in words with a remove button ("Remove filter: Status is Pending"), and "Clear all". Every change calls `onChange` with the full new value. The button opens `FilterPanel` in a `Popover` from `sm` up (`hideDetached={false}`, so it stays open while the page scrolls) and in a full-screen `Modal` below.

**`FilterPanel`** (`fields`, `value`, `onApply`, `onCancel`, `layout: 'popover' | 'fullscreen'`) — edits a draft copy (`draft.ts`): an all/any `SegmentedControl`, one `fieldset` per condition (field → operator → value; visually hidden legend "Condition N" in the popover, a bordered card with touch-sized inputs full screen), the connector ("and"/"or") between them, and "Add condition", a menu that starts from the **field**. Applying with an incomplete condition shows "Fill in a value or remove this condition." under it and does not call `onApply`; the footer sums up ("3 conditions · 1 incomplete"). In the popover, nested dropdowns (`Select`, `DateInput`, `Menu`) render inside it (`withinPortal: false`), or clicking them would close it.

Operators per type (`operators.ts`; the first is the default, labels under `ui:filters.ops.*` read differently per type):

| Type | Operators |
|---|---|
| `text` | contains, eq, neq, startsWith, endsWith, isNull, isNotNull |
| `number` | eq, neq, gt, gte, lt, lte, **between**, isNull, isNotNull |
| `date` | **between**, gte ("from"), lte ("until"), eq ("on"), gt, lt, isNull, isNotNull |
| `select` | eq, neq, **in** ("is any of" — `MultiSelect`), isNull, isNotNull |
| `boolean` | eq (Yes/No) |

`FilterBar` takes an optional **`resultCount`** ("31 results" at the right end of the bar) and an optional **`search`** (`{ value, onChange, placeholder? }`): a search box before the Filters button that calls `onChange` 300ms after typing stops (at once on Enter or when cleared) and follows `value` when it changes outside (back/forward). `opened` / `onOpenedChange` control the panel from elsewhere (e.g. "Edit filters").

**`FilteredEmptyState`** (`title`, `description?`, `onEditFilters?`, `onClear`) — the `DataTable` `emptyState` for a list emptied by its search or filters: why, plus "Edit filters" and "Clear search and filters". Not to be confused with `EmptyState` (nothing created yet).

Values sent to the API: numbers for `number` fields, `true`/`false` for `boolean`, `YYYY-MM-DD` strings for dates, a list for `in`, a `[from, to]` pair for `between` (inclusive), none for `isNull`/`isNotNull`. `describe.ts` turns a condition into words (option labels, Yes/No, dates in the user's locale).

## Form validation utilities

Three files under `src/utils/` provide a shared validation API consumed by every module's `validation.ts`.

### Error messages (`validator-messages.ts`)

Exports `msg` — the single place where all validation error strings are produced. The module uses the shared i18next singleton directly with `{ ns: 'ui' }`, so strings react to language changes automatically.

```ts
// packages/ui/src/utils/validator-messages.ts
import i18n from 'i18next'

export const msg = {
  required:  () => i18n.t('validation.required',  { ns: 'ui' }),
  maxLength: (max: number) => i18n.t('validation.maxLength', { ns: 'ui', max }),
  minLength: (min: number) => i18n.t('validation.minLength', { ns: 'ui', min }),
  minFiles:  (min: number) => i18n.t('validation.minFiles',  { ns: 'ui', count: min }),
  email:     () => i18n.t('validation.email', { ns: 'ui' }),
}
```

**Translation strings** live in `packages/ui/src/i18n/locales/en.json` and `pt-BR.json` under the `validation.*` key — **not** in `apps/web`'s `common.json`. Adding a new validator primitive requires:
1. Adding a `msg.xxx()` entry calling `i18n.t('validation.xxx', { ns: 'ui' })`
2. Adding `validation.xxx` keys to `packages/ui/src/i18n/locales/en.json` and `pt-BR.json`

**No app-side wiring needed**: the consumer just registers the `'ui'` namespace (see `apps/web/src/i18n/index.ts`). i18next is a shared singleton via `peerDependency` — both packages see the same instance, so language changes propagate automatically.

**Safe at runtime**: if `i18n.t()` is called before the namespace is registered (e.g. in an isolated Storybook without i18n setup), i18next returns the raw key string (`"validation.required"`) instead of crashing.

### Validator primitives (`validators.ts`)

Each primitive is a function `(value) => string | null`. Import from `@helix/ui`.

| Export | Signature | Notes |
|--------|-----------|-------|
| `Validator<T>` | `type` | `(value: T) => string \| null` — use to annotate custom validators |
| `required` | `Validator<unknown>` | Fails on falsy values and whitespace-only strings |
| `requiredHtml` | `Validator<string>` | Like `required` but strips HTML tags first — use for `RichTextEditor` fields |
| `maxLength(n)` | `(max: number) => Validator<string>` | |
| `minLength(n)` | `(min: number) => Validator<string>` | |
| `minFiles(n)` | `(min: number) => Validator<unknown[]>` | Use for `FilesInput` fields — fails when `value.length < min` |
| `email` | `Validator<string>` | Basic format check |
| `rules(...fns)` | `<T>(...Validator<T>[]) => Validator<T>` | Composes validators left-to-right, returns first error |

### Validator factory (`create-validator.ts`)

`createValidator` builds the `validate` object for `useForm`. It is curried so that `TValues` is explicit while `TSchema` (the exact schema shape) is inferred from the argument — this makes all fields in the return type required rather than optional:

```ts
// validation.ts
import { createValidator, required, requiredHtml, maxLength } from '@helix/ui'
import type { XxxFormValues } from './types'

export const xxxFormValidate = createValidator<XxxFormValues>()({
  // array syntax — validators run left-to-right, first error wins
  title: [required, maxLength(200)],

  // function syntax — access other fields for cross-field rules
  date: (v, values) => (values.status !== 'pending' ? required(v) : null),

  // use requiredHtml for RichTextEditor fields (strips tags before checking)
  content: [requiredHtml, maxLength(1000)],
})
```

Each field accepts either an array of `Validator<T>` (composed with `rules` internally) or a `(value, values) => string | null` function for cross-field logic. The two forms cannot be mixed per field — use the function form when you need `values`.

## Styling conventions

**Always use `createStyles` + `useStyles` — never the `style` prop.** Inline `style={{...}}` on any component is forbidden; move every CSS rule into a `createStyles` block:

```tsx
// ✅ correct
const { classes } = useStyles()
<Text className={classes.label}>…</Text>

const useStyles = createStyles(() => ({
  label: css`
    letter-spacing: 0.5px;
  `,
}))

// ❌ wrong
<Text style={{ letterSpacing: '0.5px' }}>…</Text>
```

**Only declare `createStyles` parameters you actually use.** If none of `theme`, `_`, `u` are referenced in the block, use `() => ({…})`. If only `theme` is needed, use `(theme) => ({…})`. Never declare `(theme, _, u)` unless all three are referenced:

```ts
// ✅ no theme needed
createStyles(() => ({ … }))

// ✅ only theme
createStyles((theme) => ({ … }))

// ✅ theme + u (light/dark selectors)
createStyles((theme, _, u) => ({ … }))

// ❌ declared but unused
createStyles((theme, _, u) => ({ label: css`color: red;` }))
```

**Theme tokens over raw CSS variables.** Always access values through the `theme` object — never raw CSS vars:

```ts
// ✅ correct
padding: ${theme.spacing.md};
color: ${theme.colors.gray[6]};

// ❌ wrong
padding: var(--mantine-spacing-md);
color: var(--mantine-color-dimmed);
```

**Focus rings**: every custom focus outline must also declare `animation: var(--helix-focus-ring-animation);` so it animates like Mantine's built-in focus ring. The token and keyframes live in `src/global.css` (Mantine has no motion tokens) and resolve to `none` under `prefers-reduced-motion`.

**Spacing**: always `${theme.spacing.*}`. **Colors**: always `${theme.colors.*[shade]}`, `${theme.white}`, or `${theme.black}`. The `light-dark()` CSS function is allowed for simple rgba literals only.

## Props convention

Follows the monorepo-wide rule (see root `CLAUDE.md`): props defined as `interface` (never `type`), named `props` parameter typed `Readonly<...>`, destructured inside the function body — never in the signature.

Every props interface must be `export`ed from its file so consumers can reference it.

## `AppRoute` type

`src/components/sidebar/types.ts` references `RegisteredRouter` from `@tanstack/react-router`. This type is augmented by `apps/web`'s route tree at compile time, so `SidebarItem.to` / `SidebarLink.to` are automatically constrained to valid app routes. No changes needed here when routes are added in `apps/web`.

## Asset type declarations

`src/declarations.d.ts` provides wildcard module declarations for `*.css`, `*.svg`, and `@fontsource-variable/*`. Add new asset patterns here — never create per-file `.d.ts` files for assets.
