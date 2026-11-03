# packages/api-client

Automatic generation of types, fetchers, hooks, and mocks from the API's OpenAPI spec (`apps/api`). Consumed by `apps/web`.

## Exports

| Entry point               | Content                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `@helix/api-client`       | `configure({ baseUrl })` — configures the fetch client base URL; `ApiError` |
| `@helix/api-client/hooks` | Fetchers, queryKey helpers, React Query hooks (generated)       |
| `@helix/api-client/types` | TypeScript types for the API contracts (generated)              |
| `@helix/api-client/mocks` | Faker factories and MSW handlers (generated)                    |

## Files maintained in the repo

```
src/client.ts     ← custom fetch client (NOT generated)
index.ts          ← re-exports configure()
kubb.config.ts    ← generator configuration
openapi.json      ← static committed spec (API contract)
```

`src/generated/` is generated and in `.gitignore` — do not edit manually.

## Fetch client (`src/client.ts`)

Implements the interface expected by kubb. Responsible for:

- Building the URL by appending the path to `_baseUrl` (`${_baseUrl}${url}`) — `new URL(url, base)` would drop the base's `/api`
- Sending `credentials: "include"` (better-auth session cookies)
- Throwing `ApiError` (an `Error` with `status` and optional `code`) when `!response.ok` — `message` comes from the body's `message` (falling back to `statusText`), `code` from the body's `code` when the API sends one
- Resolving `204 No Content` to `data: null` — React Query rejects `undefined` as query data, so a GET that can return 204 (e.g. `GET /me/subscription`) must yield `null`
- Returning `{ data, status, statusText, headers }`

Branch on `status` — and on `code` when one status has several meanings — to show a specific, translated message instead of the API's English one:

```ts
import { ApiError } from '@helix/api-client'

onError: (error) => {
  const message =
    error instanceof ApiError && error.code === 'external_id_taken'
      ? t('notifications.externalIdTaken')
      : t('notifications.createFailed')
  notify({ status: 'danger', message })
}
```

When an API route returns several errors with the same status, give each a stable `code` in the response body (see `POST /subscriptions` 409s).

`configure({ baseUrl })` must be called once before any fetch — in `apps/web/src/main.tsx` for the app, and in `vitest.setup.ts` for tests — with `API_URL` (`apps/web/src/lib/api-url.ts`: `VITE_API_URL` + `/api`). The spec's paths are relative to its server, `/api` (`servers` in `openapi.json`), so the base must include it. The MSW handlers are generated for `http://localhost:3333/api` (`pluginMsw` `baseURL` in `kubb.config.ts`) — the test `VITE_API_URL` plus the prefix.

## Code generation

kubb reads the spec and generates everything in `src/generated/`:

- `types/` — one file per operation with request/response types
- `hooks/` — async fetchers + queryKey helpers + React Query hooks
- `mocks/` — faker factories + MSW handlers
- `schemas/` — JSON schemas per named component (from `pluginOas`; not consumed by the app)

**Naming** (what to import, given a route): `GET /todos` → `getTodos`, `useGetTodosSuspense`, `getTodosSuspenseQueryOptions`, `getTodosSuspenseQueryKey`, `getTodosHandler`; `GET /todos/:id` → `…TodosId…`; `POST /todos` → `postTodos`, `PostTodosMutationRequest`, `postTodosHandlerResponse201`; `PUT /roles/:id/permissions` → `putRolesIdPermissions`. Named schemas (`.meta({ id })`) give `Todo`, `PaginatedTodos` and the factories `createTodo`, `createPaginatedTodos`. An explicit `operationId` in the route overrides the name (e.g. `getMeSubscription`).

**Query keys:** `getXxxSuspenseQueryKey(params?)` is `[{ url }, ...(params ? [params] : [])]`. Calling it without params gives the prefix of every cached page, so invalidate with `invalidateQueries({ queryKey: getXxxSuspenseQueryKey() })` — never `exact: true`, which matches only the param-less key and leaves every list page stale.

### Commands

| From the repo root | In `packages/api-client` | Does |
| --- | --- | --- |
| `pnpm spec:sync` | `pnpm sync` | **Run this after changing the API contract** — export, then generate (the two rows below) |
| `pnpm spec:export` | `pnpm export-spec` | Rewrites `openapi.json` from the API code (calls `pnpm --filter api spec:export <file>`) |
| `pnpm spec:generate` | `pnpm generate` | Regenerates `src/generated/` from the committed `openapi.json` (also the `postinstall`) |

### The client is generated only on demand

kubb's only input is the committed `openapi.json` (`input.path` in `kubb.config.ts`) — never the running API. `src/generated/` changes only when something regenerates it:

- `pnpm spec:sync` / `pnpm spec:generate`, by hand;
- `postinstall`, on every `pnpm install`;
- the pre-commit hook, when a staged non-test file under `apps/api/src/` changes (`apps/api/lint-staged.config.js`: exports the spec, stages it, then generates).

`pnpm dev` does **not** generate the client, and this package has no `dev` script. That is deliberate: the spec the running API serves at `/api/docs` holds only the routes its local `app.config.ts` turns on (with `subscriptions.enabled: false`, every subscription route but `/subscription/status` is gone). A client generated from it loses hooks and mocks the web imports statically, and the page dies on load (`does not provide an export named 'getMeSubscriptionQueryOptions'`; in tests, `getMeSubscriptionHandler is not a function`). Never point kubb at the running API, and never `curl` the live spec into `openapi.json`.

### Where `openapi.json` comes from

`pnpm export-spec` runs `pnpm --filter api spec:export` (`apps/api/src/scripts/export-spec.ts`), which builds the API in memory with `apps/api/src/config/spec-overrides.ts` applied and writes its spec here. No running server, database or `.env` needed.

The committed spec is the contract of the **codebase**, not of one deploy: it lists every route the API can expose (subscriptions included), whatever the local `app.config.ts` enables. `apps/web` compiles against all of them and decides at runtime what to show (`GET /subscription/status`). The spec a deploy serves at `/api/docs` still reflects its own config.

### Excluded routes

`/api/auth/*` (`/auth/*` in the spec, whose paths are relative to `/api`) is managed by better-auth on the client — excluded from generation in all plugins via `excludeAuth`.

## Workflow when creating or modifying an API endpoint

**Rule: after any change to the API contract, run `pnpm spec:sync` from the repo root before touching `apps/web`.** Nothing regenerates the client while you work — not `pnpm dev`, not the API's `tsx watch`.

The contract is anything that reaches the spec:

- a route added, removed or renamed (path, method, `operationId`);
- a request or response schema (body, params, querystring, a status in `response`, an `errorSchema(...)` code, a `.meta({ id })`);
- the permission catalog (`apps/api/src/config/permissions.ts` → the `PermissionResource` enum);
- a route registered under a config flag, or `apps/api/src/config/spec-overrides.ts` itself.

A change only to a service, a test or `app.config.ts` does not touch the contract.

1. Modify the schema/route in `apps/api`.
2. Run `pnpm spec:sync`. It rewrites the committed `openapi.json` with every optional route enabled (see _Where `openapi.json` comes from_; no API, database or `.env` needed), then regenerates `src/generated/` from it. Takes ~15s.
3. Write the web side against the new hooks, types and mocks.
4. Commit `openapi.json` with the API change. The pre-commit hook re-exports, stages and regenerates anyway, and `pre-push` blocks the push if the committed spec is stale — but those run only at commit time, so they never replace step 2.

Forgot step 2? The web fails to compile (`Module '"@helix/api-client/hooks"' has no exported member 'getXxx'`), the browser reports `does not provide an export named 'getXxx'`, or a test says `getXxxHandler is not a function`. Run `pnpm spec:sync`. If the name is still missing, check the route: is it registered (and turned on in `spec-overrides.ts` when it hangs on a flag)? Is it outside `/api/auth/*`?

## How to consume in `apps/web`

Use the generated hooks and fetchers **directly** — do not create a wrapper `hooks.ts` per module unless justified (see `apps/web/CLAUDE.md` → Step 3).

**Reads (queries)** — use the generated suspense hooks and `queryOptions` directly:

```ts
import { useGetRolesSuspense } from "@helix/api-client/hooks"
import { getRolesSuspenseQueryOptions } from "@helix/api-client/hooks"

// In a component
const { data } = useGetRolesSuspense({ page, pageSize })

// In a route loader
loader: ({ deps }) => queryClient.ensureQueryData(getRolesSuspenseQueryOptions(deps)),
```

**Mutations** — inline in the component using `useMutation` with `queryClient` for cache invalidation. Only extract to a shared `hooks.ts` when the same mutation with the same invalidation logic is used in 2+ components, or when the invalidation logic is complex (optimistic updates, rollback, conditional invalidation).

See `apps/web/CLAUDE.md` → _Step 3_ for the full mutation pattern and cache invalidation rules.

## Known limitations of the generated types

### `Date` fields are `any` in request bodies

`z.date()` / `z.coerce.date()` produce an empty schema (`{}`) in OpenAPI, which kubb turns into `any` — e.g. `PostTodosMutationRequest.date`. Send ISO date strings; `string` is assignable to `any`, so no cast is needed. Response dates arrive as ISO strings too (parse with `parseISO` from `date-fns` before formatting).

### `z.string()` fields stay `string`

The generated type is only as precise as the Zod schema. `AuditLog.action` is `string` because `auditLogSchema` declares `action: z.string()` — tighten the API schema (e.g. `z.enum([...])`) if the frontend needs a union, instead of casting in the web app.

## Named schemas (components/schemas)

`app.ts` uses `transformObject: jsonSchemaTransformObject` in `fastifySwagger`. This makes Swagger read the Zod `globalRegistry` and populate `components/schemas` with all schemas registered via `.meta({ id, title })`.

When a response schema is inlined (no `$ref`), kubb generates inline types per operation — and when it encounters an enum inside an array of objects, it produces the wrong type (e.g. `GetTodos200 = StatusEnum[]` instead of `Todo[]`). The `.meta()` on the main entity schema prevents this: kubb sees `items: { $ref: '#/components/schemas/Todo' }` and generates `Todo[]` correctly.

Rule of thumb: every schema that represents the main entity of a module (e.g. `todoSchema`, `roleSchema`) must have `.meta({ id: "PascalCaseName", title: "PascalCaseName" })`. Request body schemas (`createFeatureSchema`, `updateFeatureSchema`) don't need it — they are not arrays and don't suffer from the collision.
