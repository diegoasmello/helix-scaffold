# 𖣘 helix-scaffold

A full-stack TypeScript monorepo scaffold. Clone it, configure your env, and start building features. Authentication, RBAC, subscriptions, file uploads, email, PDF export, audit logging, a public read API for sites, and i18n are all wired in.

With Claude Code, a fresh copy becomes a product with `/start-project <description>` (rename, configuration, removal of the `todos` reference module), and each feature is added with `/new-module <description>` — both in `.agents/skills/`.

## What's included

| Feature                 | Details                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Authentication**      | Email/password + social login (Google, Facebook, Apple) via `better-auth`                                       |
| **RBAC**                | Roles, permissions, per-route guards on both backend and frontend                                               |
| **Registration modes**  | `closed` (admin-only) or `open` (self-registration) — one setting in `apps/api/src/app.config.ts`               |
| **Subscription gating** | Optional billing layer: plan catalog with per-plan features, `requireSubscription('feature')` on routes, `<RequiresSubscription feature>` in the UI, trial auto-start, generic payment processor webhook |
| **File uploads**        | Multi-file and single-file inputs with image processing (4 WebP variants via sharp), local storage provider     |
| **Email**               | Transactional email via Resend (console fallback in dev/test)                                                   |
| **PDF export**          | Server-side PDF reports via `@react-pdf/renderer`                                                               |
| **Audit log**           | Every mutation is logged; browsable admin panel                                                                 |
| **i18n**                | English and pt-BR, fully typed key safety via `i18next` + TypeScript                                            |
| **API docs**            | Scalar UI at `/api/docs`, OpenAPI spec auto-exported for client generation                                      |
| **Public API**          | Optional read-only routes under `/api/public/*` for a site using the API as a CMS: published records only, slugs, rate limit per IP, public cache |

## Architecture

pnpm monorepo with four workspaces:

| Workspace             | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| `apps/api`            | Fastify 5 + Drizzle ORM — the REST API                      |
| `apps/web`            | React 19 + Vite — the main frontend                         |
| `packages/ui`         | Shared component library (`@helix/ui`)                      |
| `packages/api-client` | Generated types, hooks, and MSW mocks from the OpenAPI spec |

## Tech stack

**Backend (`apps/api`)**

- Fastify 5 + `fastify-type-provider-zod`
- Drizzle ORM (PostgreSQL)
- better-auth
- Resend (email)
- @react-pdf/renderer

**Frontend (`apps/web`)**

- React 19 + Vite
- Mantine v9 + Emotion
- TanStack Router v1
- TanStack Query v5
- react-i18next

**Tooling**

- Turborepo (task orchestration)
- kubb (OpenAPI → TypeScript + hooks + MSW mocks)
- Vitest + RTL + MSW (unit + integration tests)
- Playwright (E2E tests)
- Drizzle Kit (migrations)

## Prerequisites

- Node.js 22+ (the API build targets `node22`)
- pnpm 10+
- Docker (for the bundled PostgreSQL databases) — or your own PostgreSQL 15+ with three databases: main, test and E2E

## Getting started

**1. Install dependencies**

```bash
pnpm install
```

**2. Start the databases**

```bash
docker compose up -d
```

This starts three PostgreSQL 17 containers (user/password `postgres`):

| Service   | Database     | Port   |
| --------- | ------------ | ------ |
| `db`      | `helix`      | `5434` |
| `db_test` | `helix_test` | `5436` |
| `db_e2e`  | `helix_e2e`  | `5438` |

**3. Configure environment**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/api/.env.test.example apps/api/.env.test
cp apps/web/.env.example apps/web/.env
```

| File                 | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `apps/api/.env`      | Backend secrets and per-deploy URLs (see [Configuration](#configuration))            |
| `apps/api/.env.test` | Overrides `.env` when running API tests — points `DATABASE_URL` to the test database |
| `apps/web/.env`      | Frontend API URL (`VITE_API_URL`)                                                    |

Edit `apps/api/.env` and set `AUTH_SECRET` (`openssl rand -base64 32`). The defaults of `DATABASE_URL`, `BASE_URL` and `CLIENT_URL`, of `.env.test` and of `apps/web/.env` already match the Docker setup and `pnpm dev`.

**4. Run database migrations**

```bash
pnpm db:migrate        # main database
pnpm db:migrate:test   # test database
```

**5. Start the dev servers**

```bash
pnpm dev
```

This starts `apps/api` on `http://localhost:3333` and `apps/web` on `http://localhost:5173` in parallel.

**6. Bootstrap the first admin**

Open `http://localhost:5173` — you will be redirected to `/bootstrap` on the first run. Create the admin account there.

Alternatively, `pnpm db:seed` fills an empty database with sample roles, users and todos — sign in as `admin@example.com` / `pass1234` (every seeded user shares that password).

## Building for production

```bash
pnpm build                       # apps/web → apps/web/dist (static files), apps/api → apps/api/dist
pnpm --filter api migrate        # apply pending migrations (node dist/migrate.js)
pnpm --filter api start          # node dist/server.js
```

`pnpm start` does not read `apps/api/.env`: give the API its environment (`DATABASE_URL`, `AUTH_SECRET`, …) from the host — including `NODE_ENV=production` (unset means `development`) and `RESEND_API_KEY`, without which a production API refuses to start rather than print emails, reset links included, to its logs. Behind a reverse proxy, set `server.trustProxy` in `app.config.ts` (`1` for one proxy, or its IPs): otherwise every client shares the proxy's IP, and with it one sign-in rate limit. The API bundle contains only `src/`, so its dependencies must be installed where it runs. `migrate` needs only `DATABASE_URL` and the production dependencies — run it before every `start` of a new version. The product config (`app.config.ts`) is bundled in, so changing it needs a rebuild.

## Testing

```bash
pnpm test              # all workspaces (Turborepo, cached)
pnpm test:coverage     # with coverage report
pnpm test:e2e          # Playwright E2E
```

| Workspace  | Tool                    | Notes                                                                  |
| ---------- | ----------------------- | ---------------------------------------------------------------------- |
| `apps/api` | Vitest + real database  | Requires `apps/api/.env.test` and `pnpm db:migrate:test`               |
| `apps/web` | Vitest + RTL + MSW      | No backend needed — API calls are intercepted by MSW                   |
| `apps/web` | Playwright              | Starts its own API (3334) and web (5174) on `helix_e2e`, emptied every run — `pnpm dev` can keep running |

Before the first E2E run, install the Playwright browser: `pnpm --filter web exec playwright install chromium`. Nothing else to configure: the suite migrates and empties `helix_e2e`, creates its admin through `POST /bootstrap` and signs in once (`e2e/global.setup.ts`).

## Configuration

Backend configuration is split in two:

- **`apps/api/src/app.config.ts`**: what your app is and does. It is committed and written with `defineConfig()`, the same way as `vite.config.ts`. Every field has inline docs on hover and is validated at startup, so a typo or an invalid value stops the API with a clear message.
- **`apps/api/.env`**: secrets and values that change per deploy. Never committed.

```ts
// apps/api/src/app.config.ts
export default defineConfig(({ mode }) => ({
  registration: { mode: 'open' },
  auth: { socialProviders: { google: { enabled: true } } },
  subscriptions: {
    enabled: true,
    plans: [
      { id: 'starter', name: 'Starter', features: ['todos'] },
      { id: 'pro', name: 'Pro', features: ['todos', 'reports'] },
    ],
    trial: { days: 14, planId: 'pro' },
  },
  email: { from: 'hello@myapp.com' },
  uploads: { maxSizeMb: 20 },
  logger: { pretty: mode !== 'production' },
}))
```

| `app.config.ts`                  | Default     | Description                                                       |
| -------------------------------- | ----------- | ----------------------------------------------------------------- |
| `registration.mode`              | `'closed'`  | `'open'` enables self-registration and social login buttons       |
| `auth.socialProviders.<name>`    | disabled    | `google` / `facebook` / `apple`; credentials go in `.env`         |
| `subscriptions.enabled`          | `false`     | Activates the full subscription infrastructure                    |
| `subscriptions.plans`            | `[]`        | Plan catalog; each plan lists the features it unlocks             |
| `subscriptions.pastDueGraceDays` | `0`         | Days a past_due subscription keeps access after a failed payment  |
| `subscriptions.trial`            | `false`     | `{ days, planId }` auto-creates a trial on self-registration      |
| `email.from`                     | `noreply@…` | Sender address for outgoing email                                 |
| `publicApi.*`                    | disabled    | The public API (`/api/public/*`): `enabled`, CORS `origins`, `cacheSeconds`, `rateLimit` |
| `uploads.*`                      | —           | Storage backend, directory, max size, anonymous rate limit, orphan cleanup schedule |
| `server.port` / `logger.*`       | `3333`      | HTTP port, log level, pretty logs                                 |
| `server.trustProxy`              | `false`     | Proxies trusted for the client IP — set it behind a reverse proxy |

| `.env`                           | Description                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`, `AUTH_SECRET`    | Required                                                          |
| `BASE_URL`, `CLIENT_URL`         | Public URLs of the API and the frontend for this deploy           |
| `RESEND_API_KEY`                 | Required in production; omit in development to log emails to the console |
| `<PROVIDER>_CLIENT_ID` / `_SECRET` | Required for each social provider enabled in `app.config.ts`    |

RBAC resources are declared in `apps/api/src/config/permissions.ts`.

Every API route is served under `/api` (endpoints, `/api/public/*`, `/api/auth/*`, `/api/docs`, `/api/files/*`), so the web and the API can share one domain: point the reverse proxy's `/api/*` at the API and everything else at the web's `index.html`. `BASE_URL`, `CLIENT_URL` and `VITE_API_URL` are origins, without the prefix.

The frontend's only env var is `VITE_API_URL` (in `apps/web/.env`). Everything else, including registration mode, enabled social providers and subscription mode, is read from the API at runtime, so there is no `VITE_*` duplication of backend settings.

## Project documentation

Every workspace and sub-module has its own `CLAUDE.md` with patterns, conventions, and step-by-step guides. Start with the repository root:

- `CLAUDE.md` — monorepo overview, registration and subscription modes, and the checklists for creating a new module (RBAC, audit logging, i18n, pagination)
- `DESIGN.md` — the UI rules (who the screens are for, actions, surfaces, responsiveness) and what to do on a screen no recipe covers
- `GLOSSARY.md` — the domain terms (plan, feature, entitlements, admin role, published…)

Then the workspace you are working in:

- `apps/api/CLAUDE.md` — backend patterns, pagination, filtering, file uploads, email, PDF export, testing
- `apps/web/CLAUDE.md` — frontend patterns, routing, forms, i18n, testing
- `packages/ui/CLAUDE.md` — shared component library, styling conventions, validation utilities
- `packages/api-client/CLAUDE.md` — code generation workflow, kubb configuration

Module-specific docs live alongside the code (e.g. `apps/api/src/modules/subscriptions/CLAUDE.md`).
