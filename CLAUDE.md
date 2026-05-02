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

## Creating a new module

By default, a new module spans **both workspaces** — backend + frontend. Unless the prompt explicitly targets one side (e.g. "add a backend endpoint for X" or "add a frontend page for X"), always implement the full stack:

1. **`apps/api`** — database schema + migration, service, routes, tests
2. **`apps/web`** — types, service, hooks, route components, tests, E2E

Before implementing either side, read the workspace-specific `CLAUDE.md` — it contains the exact file structure, patterns, and step-by-step guide to follow:

- **Backend**: `apps/api/CLAUDE.md` → _Creating a new module (CRUD)_
- **Frontend**: `apps/web/CLAUDE.md` → _Creating a new module (CRUD)_

A module is only complete when both sides are implemented and all tests are written.

### RBAC checklist

When a new module exposes user-facing resources, register it in the permission system as part of module creation:

- **Backend**: add an entry to `apps/api/src/config/permissions.ts` — defines which actions exist for the resource
- **Frontend**: add the `permission` field to the sidebar entry in `src/config/sidebar.ts`; wrap Create/Edit/Delete action buttons with `<HasPermission>`

Both workspace `CLAUDE.md` files describe the exact steps.

### Audit logging checklist

Every mutation route (POST, PATCH, DELETE) must emit an audit log entry after the service call succeeds. The audit log is best-effort: a failure must never affect the HTTP response.

- **Backend**: call `await request.audit(action, resource, resourceId?, metadata?)` after each successful mutation in the route handler. `request.audit` is injected globally in the authenticated scope via `registerAuditRequest` — route modules receive no extra parameter for this. See `apps/api/CLAUDE.md` → _Creating a new module_ → _Step 4_ for the exact pattern.

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
