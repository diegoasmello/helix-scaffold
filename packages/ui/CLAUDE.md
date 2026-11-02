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
| Page wrappers  | `PageHeader`, `PageList`, `PageCreate`, `PageEdit`, `PageView` (`page/`) | Standard CRUD screen layouts; `PageHeader` (breadcrumb + `h1` + description + actions) tops all four and custom pages |
| Data display   | `DataTable` (+ `useDataTableLayout`), `LabeledValue`, `EmptyState`, `StatusBadge` | Paginated/sortable table (no card: header band + row borders; one card per record below `sm`); label + value pair for detail views; empty list screen with a CTA slot; a record's state as a toned pill with a dot |
| Actions        | `RowActions` (+ `RowAction`), `ActionsMenu` (+ `ActionsMenuItemConfig`) | `RowActions` is every table row's actions: ≤ 3 visible → text buttons, more → one "⋯" menu; `danger`, `hidden`. `ActionsMenu` is a plain dots menu for other places |
| Forms          | `Form`                                                                  | `<form>` wrapper: runs `form.onSubmit`, blocks navigation while dirty (`blockNavigationOnDirty`, default `true`) |
| File upload    | `FilesInput`, `FileInput`, `FilePreview`, `FileCard` (`file-upload/`)   | Multi/single upload fields (the HTTP call is injected via `onUpload`) and read-only previews |
| Filtering      | `LogicalFilterForm` (`logical-filter/`)                                 | Combinable field conditions with AND/OR |
| Feedback       | `confirm()`, `notify()` (`modals/confirm`, `notifications/notify`)      | Confirm dialog helper; toast helper |
| Rich text      | `RichTextEditor`, `RichTextRenderer`                                    | Tiptap editor (HTML string value) and read-only renderer |
| Navigation     | `NavigationItem` (`navigation/`)                                        | Router-aware nav link (used by the `/me` sub-navigation) |
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
- Component defaults/styles for `Title`, `Input` (focus outline), `Button`, `Paper`, `Drawer`, `Modal` (bordered), `Menu`, `Badge` (light pill, not capitalized; `circle`/small sizes keep Mantine's geometry) and `Notification`.
- **It references `theme.colors.main`** (input focus ring, notification fallback), so any app using it must define a `main` palette.

## App shell

- **`Layout`** — `AppShell` with a 68px bordered header and a 272px sidebar (72px collapsed, persisted per user). Below `md` the sidebar renders in a `Drawer` instead (closes on navigation). Slots: `search`, `notifications`; `user` takes `{ name, description? }`.
- **`Sidebar`** — groups of items; each `SidebarItem` may carry a `badge` (`{ count, highlight? }`), an `action` (a "+" link, `{ label, to }` — `label` is its accessible name) and `links` (second level; a link's own `links` make a third). Sub-menus are tied to their parent by guide lines. Inside the drawer it gets `onClose` (close button instead of the collapse toggle).
- **`NavigationItem`** — the 44px entry used by the sidebar and the `/me` sub-navigation (active = white surface with a border). Props `size="nested"`, `badge`, `action`.
- **`HeaderSearch`** — pill input from `md` up (`Ctrl K` focuses it), an icon opening a dialog below; it only collects the query (`onSearch`).
- **`NotificationsMenu`** — bell with an unread count and a panel (`items`, `onItemClick`, `onMarkAllRead`, `onViewAll`); pure UI.
- **`RouteBreadcrumb`** — the breadcrumb built from the deepest route's `staticData.breadcrumbs` (labels are `common` keys). Renders nothing for a single crumb, or outside a router.

## `LogicalFilterForm` component

Reusable filter panel that lets users combine one or more field conditions with AND/OR logic. Used in list screens above the `DataTable`. Exports from `@helix/ui` (via `./logical-filter`):

```ts
import {
  LogicalFilterForm,
  type FilterFieldDef,
  type FilterFieldType,
  type FilterCondition,
  type LogicalFilterValue,
  type LogicalFilterFormProps,
} from '@helix/ui'
```

**Types:**

```ts
type FilterFieldType = 'text' | 'number' | 'boolean' | 'date' | 'select'

interface FilterFieldDef<T extends string = string> {
  name: T
  label: string
  type: FilterFieldType
  options?: Array<{ value: string; label: string }>  // only for 'select' type
}

interface FilterCondition {
  field: string
  op: string
  value?: string | number | boolean | null | string[]
}

interface LogicalFilterValue {
  conditions: FilterCondition[]
  logic: 'AND' | 'OR'
}
```

**Props:**

```ts
interface LogicalFilterFormProps<T extends string = string> {
  fields: FilterFieldDef<T>[]   // filterable columns for this module
  value: LogicalFilterValue      // current filter state (from URL params)
  onApply: (value: LogicalFilterValue) => void  // called on Apply and on Clear
}
```

**Behaviour:**

- The form state is strings internally; values are coerced to the correct type (`number`, `boolean`) on submit before `onApply` is called
- `isNull` / `isNotNull` operators hide the value input and omit `value` from the condition
- Clicking **Clear** calls `onApply({ logic: 'AND', conditions: [] })` — the parent is responsible for updating the URL
- Clicking **Apply** with conditions that have no value set silently skips them
- Uses `<Form blockNavigationOnDirty={false}>` — never blocks navigation

**Value input rendered per type:**

| type | Input component | Notes |
|------|-----------------|-------|
| `text` | `TextInput` | |
| `number` | `NumberInput` | Stored as string in form; coerced on submit |
| `date` | `DateInput` | Value is ISO date string; `onChange` returns `string \| null` in Mantine v9 |
| `select` | `Select` | Uses `field.options` |
| `boolean` | `Select` | Yes / No options; coerced to `true`/`false` on submit |

**Mantine v9 `DateInput` gotcha**: `onChange` returns `DateStringValue | null` (a string), not `Date | null`. Do not call `.toISOString()` on it. The value prop also accepts `string | null`, not `Date | null`.

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
