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
utilities            →  export * from "./utils" (data-table helpers)
theme helper         →  createTheme (from ./theme)
```

`CSSProperties` is explicitly re-exported from `@mantine/core` to resolve the naming conflict with `@mantine/emotion`.

## Adding a new component

1. Create `src/components/<name>/<name>.tsx`
2. Add `export * from "./<name>/<name>"` to `src/components/index.ts`

`src/index.ts` pulls everything from `src/components/index.ts` via `export * from "./components"` — never import individual component files from `src/index.ts` directly.

## Component groups

| Group         | Files                                                | Purpose                                                           |
| ------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| App shell     | `layout`, `header`, `sidebar`, `user-menu`           | Full-page scaffold rendered by `apps/web`                         |
| Page wrappers | `page-list`, `page-create`, `page-edit`, `page-view` | Standard CRUD screen layouts                                      |
| Data display  | `data-table`, `labeled-value`                        | Paginated/sortable table; label + value pair used in detail views |
| Forms         | `form`                                               | `<Form>` wrapper that handles `useForm` submission and validation |
| Feedback      | `modals/confirm`, `notifications/notify`             | `confirm()` dialog helper; `notify()` toast helper                |
| Rich text     | `rich-text-editor`, `rich-text-renderer`             | Tiptap-based editor and read-only renderer                        |
| Misc          | `language-picker`                                    | Language selection dropdown                                       |
| Theme         | `theme/index.ts`                                     | `createTheme()` — sets font defaults, accepts Mantine overrides   |

## Props convention

Follows the monorepo-wide rule (see root `CLAUDE.md`): props defined as `interface` (never `type`), named `props` parameter typed `Readonly<...>`, destructured inside the function body — never in the signature.

Every props interface must be `export`ed from its file so consumers can reference it.

## `AppRoute` type

`src/components/sidebar/types.ts` references `RegisteredRouter` from `@tanstack/react-router`. This type is augmented by `apps/web`'s route tree at compile time, so `SidebarItem.to` / `SidebarLink.to` are automatically constrained to valid app routes. No changes needed here when routes are added in `apps/web`.

## Asset type declarations

`src/declarations.d.ts` provides wildcard module declarations for `*.css`, `*.svg`, and `@fontsource-variable/*`. Add new asset patterns here — never create per-file `.d.ts` files for assets.
