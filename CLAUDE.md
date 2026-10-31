# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is a **pnpm monorepo** with the following workspaces:

| Workspace             | Description                                                                            |
| --------------------- | -------------------------------------------------------------------------------------- |
| `apps/web`            | React 19 + Vite — the main frontend application                                        |
| `apps/api`            | Fastify + TypeScript — the REST API                                                    |
| `packages/ui`         | Shared component library (`@helix/ui`), consumed by `apps/web`                         |
| `packages/api-client` | Generated types, fetchers, hooks and mocks from the OpenAPI spec (`@helix/api-client`) |

Each workspace has its own `CLAUDE.md` with patterns, conventions, and step-by-step guides specific to that context. **Always read the relevant workspace `CLAUDE.md` before working in it.**

## Commands

All root scripts run via **Turborepo** — they execute across all workspaces in parallel, with output cached where applicable.

```bash
# Development (starts apps/api + apps/web in parallel)
pnpm dev

# Build all workspaces
pnpm build

# Type-check all workspaces
pnpm type-check

# Lint all workspaces
pnpm lint

# Test all workspaces (single run)
pnpm test

# Test with coverage
pnpm test:coverage

# E2E tests (requires dev server + API running)
pnpm test:e2e

# Target a specific workspace directly (bypasses Turbo)
pnpm --filter web test:watch
pnpm --filter web preview
pnpm --filter api test:watch
```

## Tests

`pnpm test` runs all workspaces in parallel via Turbo. Results are cached — a workspace is only re-tested when its files change.

| Workspace  | Tool                        | Notes                   |
| ---------- | --------------------------- | ----------------------- |
| `apps/web` | Vitest + RTL + MSW          | Unit + integration      |
| `apps/web` | Playwright                  | E2E via `pnpm test:e2e` |
| `apps/api` | Vitest + real test database | Route integration tests |

See each workspace's `CLAUDE.md` for the full testing guide.

## Application config (`apps/api/src/app.config.ts`)

Backend settings are split in two places:

| Where | What goes there |
| --- | --- |
| `apps/api/src/app.config.ts` | **Product decisions**, committed: registration mode, subscriptions and trial, social providers on/off, email sender, uploads, server port, logger. Written with `defineConfig()` (Vite-style: a plain object or `({ mode }) => ({ ... })`). |
| `apps/api/.env` | **Secrets and per-deploy values**, never committed: `DATABASE_URL`, `AUTH_SECRET`, `BASE_URL`, `CLIENT_URL`, `RESEND_API_KEY`, OAuth client IDs/secrets. |

Read settings via `import { config } from '@/config'` (validated, defaulted, frozen) and secrets via `import { env } from '@/env'`. Never put a secret in `app.config.ts`, and never add a new product setting to `.env`. To add a setting: extend the `AppConfig` interface (with JSDoc) and `appConfigSchema` in `src/config/define-config.ts`, then set it in `app.config.ts`.

Tests (`NODE_ENV=test`) apply `src/config/test-overrides.ts` on top of `app.config.ts`: registration open, subscriptions enabled, uploads in a temp dir. The suite never depends on what a fork configures.

See `apps/api/CLAUDE.md` → _Application config_ for the full reference.

The frontend has no equivalent of these settings. It reads them from the API at runtime. Its own `apps/web/src/config/` holds only presentation concerns: `app.ts` (product name, languages), `sidebar.ts` and `theme.ts`. See `apps/web/CLAUDE.md` → _App config_.

## Registration mode

The scaffold supports two account-creation strategies, configured via `registration.mode` in `apps/api/src/app.config.ts`:

| Mode | Behaviour |
| --- | --- |
| `closed` (default) | Only admins create accounts. Bootstrap creates the first admin; subsequent users are created via `POST /users` by a permissioned admin. |
| `open` | Anyone can self-register via `/sign-up` (email/password) or via social login (Google, Facebook, Apple). Bootstrap also creates a "User" role (`isDefault = true`) with basic permissions (`me:view`, `me:edit`). New self-registered users receive this role automatically. |

**Single source of truth:** the mode lives only in the backend config. The frontend reads `GET /registration/status → { open: boolean, providers: string[] }` at route-load time — no `VITE_*` duplication.

**Social providers** are turned on per-provider in `app.config.ts` (`auth.socialProviders.<name>.enabled: true`), with their credentials in `apps/api/.env` (see `.env.example` → _Social providers_). The API refuses to start if an enabled provider has no credentials. The `providers` array in the status response lists the enabled providers only in open mode — it is always `[]` in closed mode. The frontend renders social login buttons only for the providers in this list.

**Changing the default role for open registration:** set `isDefault = true` on the desired role via the Roles admin panel. Only one role can be the default at a time (DB-enforced partial unique index). The previous default is automatically unset by the service in a transaction.

See `apps/api/src/modules/registration/CLAUDE.md` for the full backend documentation and `apps/web/src/modules/auth/CLAUDE.md` for the frontend guard/loader pattern.

## Subscription mode

The scaffold supports optional subscription gating for products that require users to have an active plan to access features.

| Setting (`app.config.ts`) | Default | Behaviour |
| --- | --- | --- |
| `subscriptions.enabled` | `false` | `true` activates all subscription infrastructure. `false` means zero overhead — no routes, no DB queries, no UI. |
| `subscriptions.plans` | `[]` | The plan catalog: `{ id, name, features }[]`. Each plan lists the **features** (free keys, usually module names) it unlocks. Required when enabled. |
| `subscriptions.pastDueGraceDays` | `0` | Days a `past_due` subscription (failed payment) keeps access while the processor retries. `0` cuts access immediately. |
| `subscriptions.trial` | `false` | `{ days, planId }`. When set (and registration is open and subscriptions are enabled), a trialing subscription is auto-created on user registration. |

**Single source of truth:** the mode lives only in the backend config. The frontend reads `GET /subscription/status → { enabled: boolean }` once at startup and caches it for the session — no `VITE_*` duplication.

**Admin bypass:** users whose role has the `subscriptions:view` permission are never blocked by `requireSubscription()`, regardless of whether they have an active subscription themselves. Operators can always access the product.

**Gating by plan feature:** `requireSubscription('reports')` on an API route, and in the UI `context.hasSubscriptionAccess('reports')` in `beforeLoad` (redirects to `/upgrade`), `<RequiresSubscription feature="reports">` or `subscriptionFeature: 'reports'` on a sidebar item, allow only users whose plan lists `'reports'`. Without a feature, any active subscription passes. A feature no plan declares fails at API startup.

**Subscription period is per user:** each `subscriptions` row has its own `currentPeriodStart`/`currentPeriodEnd`, but access is decided by `status` (`active`/`trialing`) only — dates are never compared. Who moves status to `expired`/`canceled` depends on who owns the row: subscriptions with an `externalId` belong to the payment processor and are updated by its webhooks; subscriptions without one (trial auto-start, admin panel) are expired by the scaffold's job in `server.ts` (`subscriptions.expiration.intervalHours`). A user has at most one live (`active`/`trialing`) subscription — enforced by a partial unique index.

**Subscription vs. RBAC:** these are two independent axes. RBAC controls what you're *permitted* to do (role-based). Subscription controls whether you have *paid access* (billing-based). A route can require both — subscription is checked first.

**What the scaffold does not dictate:**
- Which plans exist and which features they unlock (apps declare them in `subscriptions.plans`)
- Pricing and billing cycles (they belong to the payment processor)
- Which payment processor you use — the scaffold ships a generic webhook (`POST /webhooks/billing`) and an adapter interface; you write the adapter for your processor
- Trial duration and trial plan ID (both in `subscriptions.trial` in `apps/api/src/app.config.ts`)

See `apps/api/src/modules/subscriptions/CLAUDE.md` for the full backend documentation.  
See `apps/web/src/modules/subscriptions/CLAUDE.md` for all frontend subscription code (hooks, guard component, admin CRUD).

### Subscription checklist (when building a product on this scaffold)

When `subscriptions.enabled` is `true`, the app is responsible for:

- [ ] Declaring the plan catalog in `subscriptions.plans` (`src/app.config.ts`), with the features each plan unlocks
- [ ] Setting `subscriptions.trial: { days, planId }` in `src/app.config.ts` (if trials are offered)
- [ ] Writing a payment processor adapter and registering it in `apps/api/src/config/billing-webhook.ts` — follow the checklist in `apps/api/src/modules/billing-webhook/CLAUDE.md`
- [ ] Adding `requireSubscription('<feature>')` to routes that should be gated (inject it alongside `requirePermission` in route options, then add to the `preHandler` array)
- [ ] Gating the UI the same way: `context.hasSubscriptionAccess('<feature>')` in the routes' `beforeLoad` (redirect to `/upgrade?feature=<feature>`), `subscriptionFeature` on sidebar items, `<RequiresSubscription feature="..." fallback={<UpgradePrompt />}>` around premium sections
- [ ] Replacing the "contact an administrator" hint on `/upgrade` with your checkout call to action

## Creating a new module

By default, a new module spans **both workspaces** — backend + frontend. Unless the prompt explicitly targets one side (e.g. "add a backend endpoint for X" or "add a frontend page for X"), always implement the full stack:

1. **`apps/api`** — database schema + migration, service, routes, tests
2. **`apps/web`** — types, service, hooks, route components, tests, E2E

Before implementing either side, read the workspace-specific `CLAUDE.md` — it contains the exact file structure, patterns, and step-by-step guide to follow:

- **Backend**: `apps/api/CLAUDE.md` → _Creating a new module (CRUD)_
- **Frontend**: `apps/web/CLAUDE.md` → _Creating a new module (CRUD)_

A module is only complete when both sides are implemented and all tests are written.

### Pagination defaults

Unless the prompt explicitly says otherwise:

- **Backend**: the `GET /xxx` list endpoint is always paginated (uses `paginationQuerySchema` + `sortingQuerySchema` + `buildPaginatedResponse`).
- **Frontend**: the list screen always uses `DataTable` with `getDataTablePaginationProps` and `getDataTableSortingProps`. Never use a plain `Table` for a list screen.

The only exception is a `/all` endpoint for select-field use cases (e.g. `GET /roles/all`) — this returns a plain array with no pagination and is added only when another module needs it for a UI selector.

### RBAC checklist

When a new module exposes user-facing resources, register it in the permission system as part of module creation:

- **Backend**: add an entry to `apps/api/src/config/permissions.ts` — defines which actions exist for the resource
- **Frontend**: add the `permission` field to the sidebar entry in `src/config/sidebar.ts`; wrap Create/Edit/Delete action buttons with `<HasPermission>`

Both workspace `CLAUDE.md` files describe the exact steps.

### Audit logging checklist

Every mutation route (POST, PATCH, DELETE) must emit an audit log entry after the service call succeeds. The audit log is best-effort: a failure must never affect the HTTP response.

- **Backend**: call `await request.audit(action, resource, resourceId?, metadata?)` after each successful mutation in the route handler. `request.audit` is injected globally in the authenticated scope via `registerAuditRequest` — route modules receive no extra parameter for this. See `apps/api/CLAUDE.md` → _Creating a new module_ → _Step 4_ for the exact pattern.

### i18n checklist

The frontend is fully internationalised. Every new module that adds UI strings must ship its translations as part of the same PR — never leave hardcoded strings in components.

- **Create locale file**: add `apps/web/src/i18n/locales/en/<module>.json` with all UI strings for the module (titles, column headers, form labels, placeholders, notifications, delete confirmations, empty state, status labels). Mirror the same keys in `apps/web/src/i18n/locales/pt-BR/<module>.json` with Portuguese translations.
- **Register in i18n init**: import both locale files in `apps/web/src/i18n/index.ts` and add them to the `resources.en` and `resources['pt-BR']` objects.
- **Use in components**: call `useTranslation('<module>')` at the top of every route/component and replace all hardcoded strings with `t('key')`.
- **Cross-namespace keys** (e.g. common actions "Save", "Cancel", "Delete"): use `t('actions.save', { ns: 'common' })` — do not duplicate those strings in the module namespace.

A module is only complete when its locale files exist and no hardcoded UI string remains in its components. See `apps/web/CLAUDE.md` → _Internationalization (i18n)_ for the full guide, patterns, and testing requirements.

## React conventions

These apply to every workspace that contains React components (`packages/ui`, `apps/web`, and any future workspace).

### Props signature

Always define props as an `interface` (never `type`). Receive them as a named `props` parameter typed `Readonly<...>`, then destructure inside the function body:

```ts
interface MyComponentProps {
  foo: string;
  bar: number;
}

export function MyComponent(props: Readonly<MyComponentProps>) {
  const { foo, bar } = props;
  // ...
}
```

Never destructure directly in the function signature.

Always leave a blank line after the props destructuring before the rest of the function body:

```ts
export function MyComponent(props: Readonly<MyComponentProps>) {
  const { foo, bar } = props;

  return <div />;
}
```
