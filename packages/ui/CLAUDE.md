# packages/ui

Shared component library (`@helix/ui`). Private — not published to npm, consumed only by `apps/web` via `workspace:*`.

## Role

This package is the **single source of truth for all UI imports** in `apps/web`. It re-exports everything from Mantine, Tabler Icons, and clsx, so `apps/web` never imports those packages directly — only `@helix/ui`.

## Dependency model

UI framework packages (`@mantine/*`, `@emotion/react`, `@tabler/icons-react`, `clsx`, `dayjs`) are **direct dependencies** of this package. `apps/web` does not list them.

Only two deps remain as **peer dependencies**: `react` (singleton requirement) and `@tanstack/react-router` (needed for the `AppRoute` type augmentation — see below).

## What `src/index.ts` exports

```
side-effect imports  →  @mantine/core/styles.css, @mantine/dates/styles.css,
                        @mantine/tiptap/styles.css, @mantine/notifications/styles.css,
                        mantine-datatable/styles.css, fonts
re-exports           →  @mantine/core, @mantine/hooks, @mantine/emotion, @mantine/dates,
                        @mantine/form, @mantine/modals, @mantine/notifications,
                        @tabler/icons-react, clsx
named export         →  css (from @emotion/react — only this function, not export *)
custom components    →  export * from "./components"
hooks                →  export * from "./hooks" (use-form-blocker)
utilities            →  export * from "./utils" (data-table helpers, validator primitives, createValidator)
theme helper         →  createTheme (from ./theme)
```

`CSSProperties` is explicitly re-exported from `@mantine/core` to resolve the naming conflict with `@mantine/emotion`.

## Adding a new component

1. Create `src/components/<name>/<name>.tsx`
2. Add `export * from "./<name>/<name>"` to `src/components/index.ts`

`src/index.ts` pulls everything from `src/components/index.ts` via `export * from "./components"` — never import individual component files from `src/index.ts` directly.

## Component groups

| Group          | Files                                                | Purpose                                                           |
| -------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| App shell      | `layout`, `header`, `sidebar`, `user-menu`           | Full-page scaffold rendered by `apps/web`                         |
| Page wrappers  | `page-list`, `page-create`, `page-edit`, `page-view` | Standard CRUD screen layouts                                      |
| Data display   | `data-table`, `labeled-value`                        | Paginated/sortable table; label + value pair used in detail views |
| Forms          | `form`                                               | `<Form>` wrapper that handles `useForm` submission and validation |
| Filtering      | `logical-filter`                                     | `LogicalFilterForm` — combinable field conditions with AND/OR     |
| Feedback       | `modals/confirm`, `notifications/notify`             | `confirm()` dialog helper; `notify()` toast helper                |
| Rich text      | `rich-text-editor`, `rich-text-renderer`             | Tiptap-based editor and read-only renderer                        |
| Misc           | `language-picker`                                    | Language selection dropdown                                       |
| Theme          | `theme/index.ts`                                     | `createTheme()` — sets font defaults, accepts Mantine overrides   |

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
- Uses `<Form blockNavitationOnDirty={false}>` — never blocks navigation

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

Exports `msg` — the single place where all error strings live. When i18n is needed, replace the values here with `t(...)` calls; no validator logic changes.

```ts
export const msg = {
  required: 'Required',
  maxLength: (max: number) => `Max ${max} characters`,
  minLength: (min: number) => `Min ${min} characters`,
  minFiles: (min: number) => min === 1 ? 'At least one file is required' : `At least ${min} files are required`,
  email: 'Invalid email address',
}
```

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

**Spacing**: always `${theme.spacing.*}`. **Colors**: always `${theme.colors.*[shade]}`, `${theme.white}`, or `${theme.black}`. The `light-dark()` CSS function is allowed for simple rgba literals only.

## Props convention

Follows the monorepo-wide rule (see root `CLAUDE.md`): props defined as `interface` (never `type`), named `props` parameter typed `Readonly<...>`, destructured inside the function body — never in the signature.

Every props interface must be `export`ed from its file so consumers can reference it.

## `AppRoute` type

`src/components/sidebar/types.ts` references `RegisteredRouter` from `@tanstack/react-router`. This type is augmented by `apps/web`'s route tree at compile time, so `SidebarItem.to` / `SidebarLink.to` are automatically constrained to valid app routes. No changes needed here when routes are added in `apps/web`.

## Asset type declarations

`src/declarations.d.ts` provides wildcard module declarations for `*.css`, `*.svg`, and `@fontsource-variable/*`. Add new asset patterns here — never create per-file `.d.ts` files for assets.
