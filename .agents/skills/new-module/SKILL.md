---
name: new-module
description: Create a full-stack CRUD module (apps/api + apps/web) following the helix conventions — an interview until the module is fully understood, an approved module sheet, then database, API, client sync, web, docs, seed and verification gates.
disable-model-invocation: true
argument-hint: <module name and a free description of what it holds>
---

# New module

Request: $ARGUMENTS

The `CLAUDE.md` files are the source of truth for **how** each part is built. This skill sets the **order**, **what to read when**, and **what "done" means**. It never restates a rule from the docs — it points to the section by its heading. If a heading named here no longer exists, find where its content moved instead of improvising.

`todos` is the reference implementation on both sides. Use only the parts of it the sheet calls for; the _Section map_ below says where each part is.

## Phase 0 — Interview and module sheet (no code before approval)

Interview the user until you understand the module completely, in **rounds**:

1. Start with the module's **purpose**: what it is, what it is for, who uses it. It shapes names, labels, validation limits, empty states and seed data, and opens the module's `CLAUDE.md` later.
2. Draft the sheet below from the request. Mark each item **given** (the user said it), **deduced** (you inferred it — say from what) or **missing**.
3. Ask for every missing or ambiguous item **in one message per round**, grouped and numbered. Their answers may raise new questions — keep going, round after round, until nothing is missing or ambiguous and you could build every part without guessing. Never fill a gap with an assumption just to move on.
4. **No pattern, no improvising** — stop and tell the user when the module needs something the scaffold has no pattern for:
   - **owned records** ("each user sees only their own"): `todos` has no owner column, and an improvised ownership filter is how IDORs are born;
   - **soft delete** (records hidden instead of deleted): every module deletes for real.
5. A relation to a module that doesn't exist yet: say so, and settle whether it is built first or left out.
6. Limits come from the module's purpose — ask when it doesn't settle them. Never copy them from `todos`: its limits (1000 characters of content) fit an example, not real content.
7. **Code names** matter when singular and plural coincide (`news`): the generated hooks and types get ambiguous, so settle the entity and singular names explicitly.
8. Show the final sheet and **wait for explicit approval**. The approved sheet is the contract for the rest of the task; if the context is compacted mid-task, rebuild from it.

### Module sheet

```
Purpose:      <what it is and what it's for>
Resource:     <plural, kebab> / <singular>   Labels: en "<…>" · pt-BR "<…>"
Code names:   resource `<news>` · entity (`.meta({ id })`, the generated types) `<NewsItem>` · singular in names `<newsItem>`
Actions:      view · create · edit · delete   (drop any the module lacks)

Fields (the user fills them):
| name | type | required | limits / enum values | default | normalized |

System fields:        <field — who writes it and when, from which transition (publishedAt: the service, when status becomes published)>, or none
Business uniqueness:  <field(s) unique by product rule, or none>
Slug:                 <no | yes, from <field>>
Relations:            <field → module (select needs its /all), or none>
Uploads:              <none | single file <field> | multiple; required?> · images inside rich text <field>: <yes | no>
Delete:               hard delete · the record's uploads <deleted with it | kept>
Plan feature:         <none | <feature key>, declared in plan(s) <…>>

Deduced (confirm):
  Form:               <the control of each non-text field: two states → Switch, more → Select or SegmentedControl; rich text → RichTextEditor>
  Indexes:            FK on every reference · slug · business uniques · <performance only if the user brought up volume>
  Filters / sort:     <filters> · default sort <field dir>
  PERMISSION_REQUIREMENTS: <…>
  List columns:       <…>
  Sidebar:            <group / position>
  Seed:               <how many sample rows, what they look like> · seed roles granted <…>
```

## Section map

Read the sections the sheet calls for, at the phase that needs them. The root `CLAUDE.md` → _Module rules_ applies to every module.

`todos` shows every optional pattern at once (slug, uploads, PDF, plan feature…). **Build up, don't strip down:** take the base CRUD from `todos`, then add only the `todos` parts of the rows the sheet marks. Never copy a whole `todos` file and delete what doesn't apply.

| If the module… | `apps/api` | `apps/web` | Where `todos` shows it |
| --- | --- | --- | --- |
| always | `CLAUDE.md` → _Creating a new module (CRUD)_, _Pagination and sorting_, _Testing_ | `CLAUDE.md` → _Creating a new module (CRUD)_, _Pagination and sorting_, _Testing_, _Internationalization (i18n)_ | schema, service, routes and tests (api); list, create, edit, detail, form and tests (web) — including the permission gating of the buttons |
| has business uniques | `CLAUDE.md` → _Errors the client can act on (`DomainError`)_ | — | not in `todos`: `roles` (`name_taken`) |
| has filters | `CLAUDE.md` → _Filtering_ | `CLAUDE.md` → _Filtering_ | `FILTER_COERCE` (`todos-service.ts`); `TODO_FILTER_FIELDS`, `FilterBar` (`todos-list.tsx`) |
| has normalized columns | `CLAUDE.md` → _Normalized text columns_ | — | `TODO_NORMALIZED_FIELDS` (`db/schema/todos.ts`), `normalizedValues()` in the service, `todoRow()` |
| has a slug | `CLAUDE.md` → _Slugs_ | — (the admin never shows it) | `TODO_SLUG`, `GET /todos/by-slug/:slug`, `describe('Slug')` |
| relates to another module | `CLAUDE.md` → _Non-paginated "all" endpoints_ | `CLAUDE.md` → _Relational select fields with inline creation_ | not in `todos`: `users` → `roleId` (`GET /roles/all`, `RoleSelectField`) |
| has uploads | `src/modules/uploads/CLAUDE.md` → _Adding uploads to another module_ | `CLAUDE.md` → _Adding uploads to a new module_ | single file: `fileId`/`imageId`; multiple: `todo_attachments`; images inside rich text: `todo_content_images` (`describe('Images in the content')`); all in `src/config/upload-references.ts` |
| is gated by a plan feature | `src/modules/subscriptions/CLAUDE.md` → _`requireSubscription` hook_ | `src/modules/subscriptions/CLAUDE.md` → _Route guards (`feature` in `PageAccess`)_ | `requireSubscription('todos')` in `todos-routes.ts`; `feature: 'todos'` in `routes/access.ts` |
| exports PDF (only if asked) | `CLAUDE.md` → _PDF export_ | `CLAUDE.md` → _PDF export_ | `GET /todos/export`, `templates/todos-report.tsx`; `useExportPdf` in `todos-list.tsx` |
| sends email (only if asked) | `CLAUDE.md` → _Email_ | — | not in `todos` |

## Gate 0 — baseline (after approval, before any change)

`pnpm type-check` and `pnpm test`. Write down every failure: it already existed, so a later gate that fails the same way is not yours to fix — report it, don't touch it. Without this baseline you cannot prove which failures came with the module.

## Phase 1 — Database and API

Follow `apps/api/CLAUDE.md` → _Creating a new module (CRUD)_ in its order, with the sections the map adds. Then the seed: `src/db/seed.ts`, the way `todos` does it — sample rows from the sheet (realistic for the module's purpose; slugs through `distinctSlugs()`, normalized copies through `normalizedValues()`), and the module's permissions in the seed roles' lists as the sheet says.

### Gate 1 — the API is done (before touching `apps/web`)

1. `pnpm db:generate`, then **read the generated SQL** against the sheet: table, columns, nullability, defaults, enums, an index on every FK, uniques, slug index. Fix the Drizzle schema and regenerate on any mismatch.
2. `pnpm db:migrate` (dev) and `pnpm db:migrate:test`.
3. `pnpm --filter api type-check`, `pnpm --filter api lint` and `pnpm --filter api test` (needs `db_test` up: `docker compose up -d`).
4. `pnpm spec:sync`, then confirm the module's paths are in `packages/api-client/openapi.json`.

## Phase 2 — Web

Follow `apps/web/CLAUDE.md` → _Creating a new module (CRUD)_ in its order, with the sections the map adds.

### Gate 2 — the web is done

`pnpm --filter web type-check`, `pnpm --filter web lint`, `pnpm --filter web test`.

## Phase 3 — Docs

Written last, so they describe what was built, not what was planned.

- `apps/api/src/modules/<feature>/CLAUDE.md` and `apps/web/src/modules/<feature>/CLAUDE.md` — modelled on the `todos` ones, opening with the module's purpose from the sheet. Document what is specific to this module; point to the workspace docs for the shared patterns.
- Add the module to the root `CLAUDE.md` → _Architecture_ → module docs table, on both rows.
- Update the shared docs that **enumerate modules**. The known ones:
  - `apps/api/CLAUDE.md`: the `pnpm db:seed` row in _Scripts_, the code table in _Errors the client can act on_ (if the module returns one), and the helper list in _Test infrastructure_ (`xxxRow()`, `cleanupXxx()`);
  - `apps/web/CLAUDE.md`: the route tree in _Route tree_.

  The list is not complete: also search the `CLAUDE.md` files for where `todos` appears in an enumeration (`cleanupTodos()`, "users, roles, …, todos").

## Phase 4 — Final gate and report

### Gate 3

`pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm knip`.

**On any failed gate:** fix the cause and rerun the gate. Never weaken, skip or delete a test, and never silence knip, to get through. If you're stuck, stop and report what fails and why.

### Checklist — each item with its evidence (`file:line`), not a tick

- [ ] Resource and actions in `apps/api/src/config/permissions.ts`, plus `PERMISSION_REQUIREMENTS` → root _RBAC checklist_
- [ ] `request.audit()` after every mutation, asserted in the tests for create, edit and delete → root _Audit logging checklist_
- [ ] List paginated and sortable, `DataTable` on the web → root _Pagination defaults_
- [ ] An index on every FK; business uniques turned into a `DomainError` (409), with a test → `apps/api/CLAUDE.md` → _2. Database schema_, _Errors the client can act on_
- [ ] Normalized columns and slug exactly as the sheet says → root _Normalized text columns_, _Slugs_
- [ ] Route tests, including _Permission enforcement tests_ → `apps/api/CLAUDE.md` → _Testing_
- [ ] `PageAccess` in `routes/access.ts`, `guardPage()` on every route, the sidebar entry with the same access, `<HasPermission>` on Create, `hidden` on row actions → root _RBAC checklist_
- [ ] Locale files in `en` and `pt-BR`, registered in `src/i18n/index.ts`; the resource's label in both `roles.json` (`permissions.resources.<resource>`); no hardcoded string → root _i18n checklist_
- [ ] Web unit + integration tests → `apps/web/CLAUDE.md` → _Testing_
- [ ] If gated: `requireSubscription('<feature>')` on the routes, `feature` in the `PageAccess`, the feature's label in both `subscription.json`, and the feature **declared in a plan** in `apps/api/src/app.config.ts` (an undeclared feature stops the API at startup) → root _Subscription checklist_
- [ ] Seed rows and seed role grants
- [ ] Module `CLAUDE.md` on both sides, the root module docs table, and every shared doc that enumerates modules
- [ ] Every failure in Gate 3 either fixed or present in the Gate 0 baseline

### Report

- The sheet as built, and any deviation from the approved one with its reason.
- Each gate's result, and the baseline failures of Gate 0 apart.
- The checklist with its evidence.
- Seed: `pnpm db:seed` refuses to run on a database with users, so the sample rows show up only after `pnpm db:reset && pnpm db:seed` — **which wipes the dev database**. Tell the user; never run it yourself.
- Ask the user to open `/<feature>` in the browser and send a screenshot.
- E2E specs are not part of this skill — write them only if the user asks.
