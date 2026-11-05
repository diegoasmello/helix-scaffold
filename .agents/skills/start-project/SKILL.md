---
name: start-project
description: Turn a fresh copy of the scaffold into a product, once — an interview until the product is settled, an approved product sheet, then the rename, the removal of the reference module (`todos`, kept as reading material for /new-module), the configuration, the docs and the verification gates. The skill removes itself at the end.
disable-model-invocation: true
argument-hint: <product name and a free description of what it is for>
---

# Start project

Request: $ARGUMENTS

Runs **once**, on a fresh copy of the scaffold, before any module is built. The product is an independent fork: it never pulls from the scaffold again, so whatever it does not use is **turned off in config, never deleted** — the only code this skill removes is the reference module and what only it used. The two scripts in `scripts/` do the mechanical work; never redo their edits by hand.

**Never touch git:** no commit, no branch, no look at the history, whatever state `.git` is in. The report hands over a commit message.

## Phase 0 — Preflight

1. Confirm this is a fresh copy: `apps/api/src/modules/todos/` exists and `.agents/skills/new-module/references/todos/api` is a symbolic link. Otherwise the skill already ran, or the copy was changed: **stop and tell the user**.
2. `node .agents/skills/start-project/scripts/remove-reference-module.mjs --check` must say every edit applies. If not, stop: the scaffold's wiring changed after the script — report what it lists.

## Phase 1 — Interview and product sheet (no change before approval)

Interview in **rounds**, like `/new-module`: draft the sheet from the request, mark each item **given**, **deduced** (from what) or **missing**, ask every missing or ambiguous item in one numbered message per round, and wait for **explicit approval** of the final sheet. Save it outside the repo (your scratchpad directory, if you have one): it is what you rebuild from if the context is compacted.

```
Product:        <display name>   slug `<slug>` — [a-z][a-z0-9_]*: the databases `<slug>`, `<slug>_test`, `<slug>_e2e`, the root package
Purpose:        <what it is, for whom — a paragraph; opens the "This product" section of CLAUDE.md>
Language:       default <en | pt-BR>
Registration:   <closed | open>
Social sign-in: <none | google · facebook · apple>
Subscriptions:  <off | on>
  Plans:        <id — name>…
  Trial:        <none | <days> days on <plan id>>
  Grace:        <days a past_due subscription keeps access>
Public site:    <none | yes — origins: <the site's browser origins | none: it fetches on its server>>
Email sender:   <address>
```

What each setting does: the root `CLAUDE.md` → _Registration mode_, _Subscription mode_; `apps/api/CLAUDE.md` → _Application config_. Watch for:

- **Language** — both `en` and `pt-BR` stay offered and keep their locale files; only the default changes. The web tests assert English and use `pt-BR` for their translation cases, and `/new-module` still writes both. Say so when the user wants a single language.
- **Social sign-in needs open registration** — closed mode is email/password only, and the providers list stays empty there.
- **An enabled provider stops `pnpm dev`** until its credentials are in `apps/api/.env` (the suites keep running: `test-overrides.ts` turns the providers off). Ask whether the user has them now.
- **Plans without features** — features come from the modules, which do not exist yet: `/new-module` declares each one in a plan (its sheet's _Plan feature_). With subscriptions on, at least one plan is required.
- **Trial** — only with open registration and subscriptions on, on one of the plans.
- **Public site** — a site that reads published records without signing in (the API as a CMS) turns on the public API (`apps/api/CLAUDE.md` → _Public API_). Which modules, fields and files a site sees is decided per module by `/new-module`; here only whether there is a site, and its origins when it calls the API from the browser (none when it fetches on its server — SSR, static generation).
- **Email sender** — production needs a domain verified in Resend; anything works locally.

## Phase 2 — Rename (before any database starts)

A database gets its name when its volume is created, so this runs before `docker compose up`.

1. `node .agents/skills/start-project/scripts/rename-product.mjs <slug>` — the databases, the suites' temporary upload dirs, the root package and the color scheme's storage key. The `@helix/*` packages and the `--helix-*` CSS variables are internal names and keep them.
2. The env files, **only where missing** — never overwrite one: `apps/api/.env` from `.env.example` with a fresh `AUTH_SECRET` (`openssl rand -base64 32`), `apps/api/.env.test` from `.env.test.example`, `apps/web/.env` from `.env.example`. An existing file was renamed by the script along with the rest.

## Gate 0 — Baseline

1. `docker compose up -d`, then `pnpm db:migrate:test` and `pnpm db:check` (the dev database is only checked, not migrated: Phase 3 replaces the migrations, and a database migrated with the scaffold's would no longer match them). A "database does not exist" means the volumes were created before the rename and keep the old names: tell the user — recreating them (`docker compose down -v`) deletes the data in them, so it is theirs to run.
2. `pnpm type-check` and `pnpm test`, and write down every failure: it existed before you, so a later gate failing the same way is not yours to fix — report it.

## Phase 3 — Remove the reference module

`node .agents/skills/start-project/scripts/remove-reference-module.mjs`. It turns `.agents/skills/new-module/references/todos/` into copies, deletes the module, takes its wiring out of the shared files (into `references/todos/wiring.diff`), replaces the scaffold's migrations with a single `init` drizzle-kit generates from the schema left — the product's history starts without the module, never with a `drop_todos` — and regenerates the API client. Read the notes it prints (lines still naming todos — comments citing the reference module stay). Then `pnpm db:recreate:test` (Gate 0 migrated it with the old migrations) and `pnpm db:migrate`.

## Phase 4 — Configure

From the sheet, and nothing else:

- `apps/api/src/app.config.ts` — `app.name` (`<Product> API`), `registration.mode`, `auth.socialProviders.<name>.enabled`, `subscriptions` (`enabled`, `plans` with `features: []`, `trial`, `pastDueGraceDays`; off: `enabled: false`, the rest as it is), `publicApi` (`enabled`, `origins`), `email.from`. Every other setting keeps the scaffold's value.
- `apps/web/src/config/app.ts` — `name` and `i18n.defaultLanguage`.
- Never the test config (`src/config/test-overrides.ts`, `e2e-overrides.ts`): the suites pin their own mode, whatever the product configures.

## Phase 5 — Docs

1. **What became false.** Search every `*.md` outside `.agents/` for `todo` (any case). A line that uses `todos` as an example or as the reference ("`todos` is the reference", "see `todos-routes.ts`", "`describe('Slug')` is the reference") stays: the files are in `references/todos/`, which its README indexes. A line that says the code is **in the product** goes or changes — the known ones:
   - root `CLAUDE.md`: the module docs table (both rows), the E2E row of _Tests_;
   - `apps/api/CLAUDE.md`: `pnpm db:seed` in _Scripts_, the `todos` row of the codes table in _Errors the client can act on_, `todoRow()` and `cleanupTodos()` in _Test infrastructure_;
   - `apps/web/CLAUDE.md`: the route tree, the locale tree of _Internationalization_, the `todos.spec.ts` row of the E2E specs and `createTodo()`/`sampleFiles` in the fixtures table;
   - any `CLAUDE.md` that lists the modules (`users, roles, …, todos`).

   Where a pattern's only example was in the module ("`todoRow()` in `src/test/helpers.ts`"), point to `references/todos/` (`wiring.diff` for a shared file). Search again at the end: every remaining line is one you decided to keep.
2. **`README.md`** — the product's: its name and purpose instead of the scaffold's introduction and _What's included_, the rest (prerequisites, getting started, testing, configuration) kept and checked against the rename (database names) and the sheet.
3. **Root `CLAUDE.md`** — a `## This product` section right after the title: the purpose, then the sheet's decisions (registration, social sign-in, subscriptions and plans, public site, default language), and that it has no module of its own yet (`/new-module`).

## Gate 1 — Final

`pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm knip` and `pnpm test:e2e` (`docker compose up -d db_e2e`; install the browser once: `pnpm --filter web exec playwright install chromium`). On a failure, fix the cause and rerun — never weaken, skip or delete a test, never silence knip. If you're stuck, stop and report what fails and why.

## Phase 6 — Remove this skill

Only after Gate 1 passes:

- `.agents/skills/start-project/` and its link `.claude/skills/start-project`;
- the block of `.husky/pre-push` that runs `remove-reference-module.mjs --check` (with its comment);
- the sentence about that check in the root `CLAUDE.md` → _Git hooks_ → `pre-push`, and its section _Starting a product_.

Then `pnpm knip` once more.

## Report

- The sheet as applied, and any deviation with its reason.
- Each gate's result, the Gate 0 failures apart.
- What only the user can do, in this order:
  1. **Secrets and per-deploy values** in `apps/api/.env` — `.env.example` lists them; production needs its own `AUTH_SECRET`, `RESEND_API_KEY`, `BASE_URL`, `CLIENT_URL`.
  2. **Behind a reverse proxy** (nginx, a load balancer, Cloudflare): `server.trustProxy` in `app.config.ts` — every rate limit counts per client IP (sign-ins, and with a public site `/api/public/*` and the public files), and without it all clients share the proxy's.
  3. **Social sign-in**: each enabled provider's credentials (`.env.example` → _Social providers_) — `pnpm dev` refuses to start without them.
  4. **The first admin**: open the app, `/bootstrap`.
  5. **Subscriptions** (on): the payment processor adapter (`apps/api/src/modules/billing-webhook/CLAUDE.md` → checklist) and the `/upgrade` call to action — root `CLAUDE.md` → _Subscription checklist_.
  6. **Branding**: the logo (`packages/ui/src/assets/helix.svg`, `helix-icon.svg` and their `alt` in `packages/ui/src/components/layout/layout.tsx`) and the primary color (`apps/web/src/config/theme.ts`).
  7. **The default role** (open registration): grant it what regular users need once the modules exist — root `CLAUDE.md` → _Registration mode_.
- The commit message and the paths to `git add` — never commit.
- Next: `/new-module` for the first module.
