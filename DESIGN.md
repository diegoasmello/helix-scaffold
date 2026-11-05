# Design

How screens look and behave in a product built on this scaffold: the rules, the reasons behind them, and what to do on a screen no recipe covers. Read it before building or changing any UI.

What lives elsewhere — this file does not repeat it:

| Where | What |
| --- | --- |
| `packages/ui/CLAUDE.md` | Every `@helix/ui` component and its props (_Component groups_), the theme's tokens (_Theme_), the app shell, the page wrappers, the styling conventions (`createStyles`, never the `style` prop) |
| `apps/web/CLAUDE.md` → _Screen components_ | The CRUD recipes: list, create/edit form, detail, footer buttons, status column, empty state, row actions |
| `packages/ui/src/theme/index.ts`, `apps/web/src/config/theme.ts` | The token values themselves — read them there, never copy them into a doc |

## Who the screens are for

Products built on Helix serve people with **little familiarity with technology**. Most rules below follow from that:

- **Every action is visible and says what it does.** A word is read; an icon has to be guessed.
- **Nothing happens on something that doesn't look clickable.** A row, a card's text, a label does nothing on click.
- **Every page is laid out the same way**, so learning one page teaches all of them: same shell, same header, same place for the primary action, same footer.
- **Every screen works on a phone.** Responsiveness is not optional.

When a case is not covered here, decide by these four, in this order.

## Principles

1. **Explicit over clever** — labeled buttons, conditions written as sentences (`FilterBar` chips: "Status is Pending"), messages that say what to do next.
2. **Familiar** — one shell for the whole product: header with search, notifications and the user menu; sidebar with the modules. A screen never brings its own navigation.
3. **Flat and quiet** — surfaces are separated by 1px borders, never by shadows; no gradients; color is kept for meaning (the primary action, a status, danger).
4. **Same everywhere** — reuse `@helix/ui` before building anything. Two screens that solve the same problem differently teach the user two things.
5. **Every width** — each screen is designed for desktop, below 1024px and phone, not adapted afterwards.

## Rules

### Actions

- **Buttons carry text.** An icon in `leftSection` is welcome, but next to the text, not instead of it.
- **An icon alone is the exception, and it always has a tooltip.** It is allowed where room is short or the icon is universal — removing a filter chip, the header's bell, search and menu on phones, a "+" next to a select, a toolbar. Such a control **must** have:
  - an `aria-label` (tests find it with `getByRole('button', { name })`), and
  - a `Tooltip` showing **the same text**:

  ```tsx
  const label = t('actions.edit', { ns: 'common' })

  <Tooltip label={label}>
    <ActionIcon variant="default" aria-label={label} onClick={onEdit}>
      <IconPencil size={16} />
    </ActionIcon>
  </Tooltip>
  ```

  A tooltip never shows on a touch screen, so it is a hint, not the only place the meaning lives: the icon itself must be one people recognize.
- **Row actions** are always `<RowActions>`: text buttons (View / Edit / Delete) up to `maxInlineActions` (default 3), more collapse into one "⋯" menu. **Rows are never clickable** — every action comes from its button.
- **One primary button per area** (the page header's actions, the footer). The others are `variant="default"`.
- **Destructive actions** are `variant="default" color="red"` (the theme turns that into the bordered red button) and always ask first with `confirm()`.
- **Every mutation answers**: `notify()` after it succeeds or fails. The user never wonders whether a click worked.

### Surfaces

- **No shadows, no gradients.** The theme sets every `shadows.*` to `none` — don't pass `shadow`, and never add a `box-shadow` to separate things. Use a 1px border (`gray[3]` / `dark[5]`).
- **A page's content sits on the page.** No `Paper` or `Card` around a page's table, form or detail — `PageList`, `PageCreate`, `PageEdit` and `PageView` are flat on purpose.
- **Cards are for things that are each a unit**: dashboard tiles, the plan cards (`subscriptions/components/plan-catalog.tsx`), the records of a list on phones (`DataTable` does this itself). They are bordered (`Paper`/`Card` default to `withBorder`), never raised.
- **No decorative lines.** Not under a page title, not between `FormSection`s, not between the fields of a detail page (`LabeledValue`s in a `Grid`). Spacing does the grouping.

### Color

- `main` (the primary color) marks the primary action, the active item and focus — nothing else.
- A record's state is a `StatusBadge` with a tone (`success`, `warning`, `danger`, `info`, `neutral`), never a colored `Badge` or colored text.
- Red is for destructive actions and errors only.
- Never color alone: a status has its word, an error its message.
- Always through the theme (`${theme.colors.gray[6]}`), never a hex value or a raw `var(--mantine-*)`.
- **Light and dark.** The user picks the scheme in `/me/preferences`, so every screen works in both. Write the dark variant with `u.dark` in `createStyles` (see `packages/ui/CLAUDE.md` → _Styling conventions_) wherever a color is set by hand.

### Text

- Every string comes from i18n, in both locales (root `CLAUDE.md` → _i18n checklist_).
- Sentence case ("Create user", "Unsaved changes"), short.
- Buttons are verbs that name the result ("Create user", "Save changes"), never "OK" or "Submit".
- Empty states say why the screen is empty and offer the next step (`EmptyState` with a CTA; `FilteredEmptyState` when a search or filter emptied it).
- Errors say what to do ("Fix the 2 highlighted fields below"), not what failed internally.

### Responsiveness

- **Below `md` (1024px)** the sidebar becomes a drawer and the header goes compact (the shell does this). **Below `sm`** `DataTable` turns into cards and page actions fill the width (the page wrappers do this). Custom content must follow the same two steps.
- **No horizontal scroll on the page.** Content wider than the screen (a board, a calendar, a wide grid) scrolls inside its own container, or offers a list layout on phones.
- **Nothing depends on hover.** Hover may reveal a hint (a tooltip); it never reveals an action or information that isn't reachable otherwise.
- Touch-sized controls on phones: the sidebar's 44px items and the full-screen `FilterPanel` are the reference.

### Accessibility

- Every icon-only control has an `aria-label` (and its tooltip, above).
- A custom focus outline declares `animation: var(--helix-focus-ring-animation);` (`packages/ui/CLAUDE.md` → _Styling conventions_).
- Headings follow the page: one `h1` (the `PageHeader` title, which is also the tab title), `h2` per section. A `FormSection` is a `region` named by its title.

## A screen no recipe covers

The CRUD recipes cover lists, forms and details. For anything else:

1. **Start inside the shell.** The screen is a route rendered in `Layout`, opens with a `PageHeader` (title, optional description, `actions`; the breadcrumb shows on custom pages) and keeps the page gutters (`--helix-page-px`/`pt`/`pb`).
2. **Look in `@helix/ui` first** (`packages/ui/CLAUDE.md` → _Component groups_), then in Mantine, which `@helix/ui` re-exports — `apps/web` never imports `@mantine/*` directly.
3. **Compose in the module** (`apps/web/src/modules/<module>/components/`) when the piece shows that module's data.
4. **Create a component in `packages/ui`** only when it is generic (no module data, no API call — those come in by props) and a second screen will use it. It ships with: an `interface` for its props (root `CLAUDE.md` → _React conventions_), its strings in the `ui` namespace, light and dark, its phone layout, tests, and a row in `packages/ui/CLAUDE.md` → _Component groups_.
5. **A new library** (charts, calendar, drag and drop) is added to `packages/ui` and re-exported from it, so `apps/web` keeps importing only from `@helix/ui`.

### Recipes

- **Dashboard / overview** — `PageHeader`, then a `SimpleGrid` of bordered `Card`s (`cols={{ base: 1, sm: 2, lg: 4 }}` for metric tiles); each tile has a label, the value and, when there is one, a link to the list behind it. Charts and tables below, each in its own bordered card with a title.
- **Settings / profile** — `PageTabs` for the areas, one route per tab, `FormSection`s per group, the sticky footer from `PageEdit`. `/me` is the example.
- **Several steps (wizard)** — Mantine's `Stepper` above the content, each step's fields in a `FormColumn` or `FormSection`s, and the footer: Back (`default`) and Next / Finish (primary). Unsaved progress is protected by `Form`'s `blockNavigationOnDirty`.
- **Quick create without leaving the page** — a `Drawer` holding the module's `FormColumn` form (`roles/components/role-create-drawer.tsx`).
- **Board, calendar, timeline** — the wide area scrolls inside its own container; on phones, a list of the same items (one column, or grouped by the board's columns).
- **Pages outside the shell** (sign-in, sign-up, password reset, bootstrap) — centered, one bordered `Paper` about 400px wide, the form inside. `auth/routes/login.tsx` is the example.

### Loading, empty and error

- **Loading**: the route's `pendingComponent` — `<Center h={200}><Loader /></Center>` in the module's `routes/<module>-pending.tsx`. Inside a page, a `Loader` in place of the section that is loading, not a blank area.
- **Empty**: `EmptyState` (nothing created yet, with a CTA to create the first) or `FilteredEmptyState` (search or filters left nothing).
- **Error**: the route tree's `ErrorBoundary` (`apps/web/src/routes.ts`) for a page that failed to load; `notify({ status: 'error' })` for an action that failed; the field's own message for invalid input.

## What a product changes, and what stays

| A product changes | It keeps |
| --- | --- |
| The `main` palette (`apps/web/src/config/theme.ts`), product name and languages (`config/app.ts`), logo, sidebar entries (`config/sidebar.ts`) | Everything under _Rules_: text buttons, the icon-only tooltip, no clickable rows, borders instead of shadows, color for meaning, light and dark, every width |

A product may change a rule on purpose — then it changes it **here**, with the reason, so the next agent follows the new rule and not the old one.

## Before handing a screen over

- [ ] Built from `@helix/ui`; no `style` prop; theme tokens only
- [ ] Works in light and dark
- [ ] Works at desktop width, below 1024px and on a phone (~375px), with no page-level horizontal scroll
- [ ] Every icon-only control has an `aria-label` **and** a `Tooltip` with the same text
- [ ] No clickable rows, no hover-only actions or information
- [ ] Loading, empty and error states handled
- [ ] Every string translated in both locales
- [ ] Ask the user to open the screen and send screenshots (desktop and phone width) — don't automate a browser for it
