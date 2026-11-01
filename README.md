# 𖣘 helix-scaffold

A full-stack TypeScript monorepo scaffold. Clone it, configure your env, and start building features. Authentication, RBAC, subscriptions, file uploads, email, PDF export, audit logging, and i18n are all wired in.

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
| **API docs**            | Scalar UI at `/docs`, OpenAPI spec auto-exported for client generation                                          |

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

- Node.js 20+
- pnpm 10+
- Docker (for the bundled PostgreSQL databases) — or your own PostgreSQL 15+ with two databases: main + test

## Getting started

**1. Install dependencies**

```bash
pnpm install
```

**2. Start the databases**

```bash
docker compose up -d
```

This starts two PostgreSQL 17 containers (user/password `postgres`):

| Service   | Database     | Port   |
| --------- | ------------ | ------ |
| `db`      | `helix`      | `5434` |
| `db_test` | `helix_test` | `5436` |

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
| `apps/web/.env`      | Frontend API URL (`VITE_API_URL`) and E2E login credentials                          |

Edit `apps/api/.env` and fill in at minimum:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/helix
AUTH_SECRET=YOUR_SUPER_SECRET_HERE
BASE_URL=http://localhost:3333
CLIENT_URL=http://localhost:5173
```

The `.env.test` and `apps/web/.env` defaults already match the Docker setup.

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

Alternatively, `pnpm db:seed` fills an empty database with sample roles, users and todos (the admin credentials are in `apps/api/src/db/seed.ts`).

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
| `apps/web` | Playwright              | Starts `pnpm dev` automatically (or reuses a running one). Only the sign-in setup exists so far |

Before the first E2E run:

1. Install the Playwright browsers: `pnpm --filter web exec playwright install`
2. Set `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` in `apps/web/.env` to an existing user (e.g. the admin created via `/bootstrap`). `e2e/auth.setup.ts` signs in once with these credentials and every E2E test reuses the saved session.

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
| `subscriptions.trial`            | `false`     | `{ days, planId }` auto-creates a trial on registration           |
| `email.from`                     | `noreply@…` | Sender address for outgoing email                                 |
| `uploads.*`                      | —           | Storage backend, directory, max size, orphan cleanup schedule     |
| `server.port` / `logger.*`       | `3333`      | HTTP port, log level, pretty logs                                 |

| `.env`                           | Description                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`, `AUTH_SECRET`    | Required                                                          |
| `BASE_URL`, `CLIENT_URL`         | Public URLs of the API and the frontend for this deploy           |
| `RESEND_API_KEY`                 | Omit to fall back to console email logging                        |
| `<PROVIDER>_CLIENT_ID` / `_SECRET` | Required for each social provider enabled in `app.config.ts`    |

RBAC resources are declared in `apps/api/src/config/permissions.ts`.

The frontend's only env var is `VITE_API_URL` (in `apps/web/.env`). Everything else, including registration mode, enabled social providers and subscription mode, is read from the API at runtime, so there is no `VITE_*` duplication of backend settings.

## Project documentation

Every workspace and sub-module has its own `CLAUDE.md` with patterns, conventions, and step-by-step guides. Start with the repository root:

- `CLAUDE.md` — monorepo overview, registration and subscription modes, and the checklists for creating a new module (RBAC, audit logging, i18n, pagination)

Then the workspace you are working in:

- `apps/api/CLAUDE.md` — backend patterns, pagination, filtering, file uploads, email, PDF export, testing
- `apps/web/CLAUDE.md` — frontend patterns, routing, forms, i18n, testing
- `packages/ui/CLAUDE.md` — shared component library, styling conventions, validation utilities
- `packages/api-client/CLAUDE.md` — code generation workflow, kubb configuration

Module-specific docs live alongside the code (e.g. `apps/api/src/modules/subscriptions/CLAUDE.md`).
