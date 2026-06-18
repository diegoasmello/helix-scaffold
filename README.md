# 𖣘 helix-scaffold

A full-stack TypeScript monorepo scaffold. Clone it, configure your env, and start building features. Authentication, RBAC, subscriptions, file uploads, email, PDF export, audit logging, and i18n are all wired in.

## What's included

| Feature                 | Details                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Authentication**      | Email/password + social login (Google, Facebook, Apple) via `better-auth`                                       |
| **RBAC**                | Roles, permissions, per-route guards on both backend and frontend                                               |
| **Registration modes**  | `closed` (admin-only) or `open` (self-registration) — toggled via a single env var                              |
| **Subscription gating** | Optional billing layer: `requireSubscription()` on routes, `<RequiresSubscription>` in the UI, trial auto-start |
| **File uploads**        | Multi-file and single-file inputs with image processing (4 WebP variants via sharp), local storage provider     |
| **Email**               | Transactional email via Resend                                                                                  |
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
- PostgreSQL 15+ (two databases: main + test)

## Getting started

**1. Install dependencies**

```bash
pnpm install
```

**2. Configure environment**

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and fill in at minimum:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/helix
AUTH_SECRET=YOUR_SUPER_SECRET_HERE
BASE_URL=http://localhost:3333
CLIENT_URL=http://localhost:5173
```

**3. Run database migrations**

```bash
pnpm db:migrate
```

**4. Start the dev servers**

```bash
pnpm dev
```

This starts `apps/api` on `http://localhost:3333` and `apps/web` on `http://localhost:5173` in parallel.

**5. Bootstrap the first admin**

Open `http://localhost:5173` — you will be redirected to `/bootstrap` on the first run. Create the admin account there.

## Configuration

All backend configuration lives in `apps/api/.env`. See `.env.example` for the full list with descriptions. The most important knobs:

| Variable                         | Default     | Description                                                      |
| -------------------------------- | ----------- | ---------------------------------------------------------------- |
| `REGISTRATION_MODE`              | `closed`    | `open` enables self-registration and social login buttons        |
| `SUBSCRIPTION_MODE`              | `disabled`  | `enabled` activates the full subscription infrastructure         |
| `SUBSCRIPTION_TRIAL_DAYS`        | —           | Auto-creates a trialing subscription on registration when set    |
| `RESEND_API_KEY`                 | —           | Omit to fall back to console email logging                       |
| `GOOGLE_CLIENT_ID` / `_SECRET`   | —           | Enables Google social login when both are set and mode is `open` |
| `FACEBOOK_CLIENT_ID` / `_SECRET` | —           | Enables Facebook social login                                    |
| `APPLE_CLIENT_ID` / `_SECRET`    | —           | Enables Apple social login                                       |
| `STORAGE_PROVIDER`               | `local`     | File storage backend (`local` is fully implemented)              |
| `UPLOAD_DIR`                     | `./storage` | Local storage directory                                          |

The frontend reads its configuration from the API at runtime — no `VITE_*` env vars to maintain.

## Project documentation

Every workspace and sub-module has its own `CLAUDE.md` with patterns, conventions, and step-by-step guides. Start with the workspace root:

- `apps/api/CLAUDE.md` — backend patterns, pagination, filtering, file uploads, email, PDF export, testing
- `apps/web/CLAUDE.md` — frontend patterns, routing, forms, i18n, testing
- `packages/ui/CLAUDE.md` — shared component library, styling conventions, validation utilities
- `packages/api-client/CLAUDE.md` — code generation workflow, kubb configuration

Module-specific docs live alongside the code (e.g. `apps/api/src/modules/subscriptions/CLAUDE.md`).
