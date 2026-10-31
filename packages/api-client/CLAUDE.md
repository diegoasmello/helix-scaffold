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

- Building the URL via `new URL(url, _baseUrl)`
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

`configure({ baseUrl })` must be called once before any fetch — in `apps/web/src/main.tsx` for the app, and in `vitest.setup.ts` for tests (with `http://localhost:3333`).

## Code generation

kubb reads the spec and generates everything in `src/generated/`:

- `types/` — one file per operation with request/response types
- `hooks/` — async fetchers + queryKey helpers + React Query hooks
- `mocks/` — faker factories + MSW handlers

### How kubb determines the spec source

```bash
# dev — reads from the running API (always up to date)
kubb generate
# equivalent to: input.path = "http://localhost:3333/docs/openapi.json"

# build / CI — reads from the committed file (no API dependency)
KUBB_INPUT=./openapi.json kubb generate
```

The `KUBB_INPUT` variable overrides `input.path` in `kubb.config.ts`.

**Pitfall:** the running API only exposes routes enabled by its local `apps/api/src/app.config.ts` — with `subscriptions.enabled: false`, every subscription route except `/subscription/status` is missing from its spec. Generating (or `export-spec`) from it silently drops those hooks and mocks, and web tests fail with `getMeSubscriptionHandler is not a function`. The committed `openapi.json` must include them: export it with subscriptions enabled, and prefer `KUBB_INPUT=./openapi.json` when in doubt.

### Excluded routes

`/api/auth/*` is managed by better-auth on the client — excluded from generation in all plugins via `excludeAuth`.

## Workflow when creating or modifying an API endpoint

1. Modify the schema/route in `apps/api`
2. With the API running (`pnpm dev`), export the updated spec:
   ```bash
   pnpm export-spec
   ```
   This runs `curl http://localhost:3333/docs/openapi.json -o openapi.json` and updates the committed file.
3. Regenerate the files in `src/generated/`:
   ```bash
   pnpm generate
   ```
   In continuous dev, `pnpm dev` does this automatically via `--watch`.
4. Commit `openapi.json` alongside the other changes.

The `postinstall` script in package.json runs `kubb generate` with `KUBB_INPUT=./openapi.json` — so `pnpm install` at the root always regenerates `src/generated/` from the committed file, without needing the API running.

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

## Known kubb bugs

### 1. `date: any` fields in todos/mutations

`z.date()` and `z.coerce.date()` generate `{}` in OpenAPI, which kubb converts to `any`. Affects `PostTodosMutationRequest.date` and `PatchTodosIdMutationRequest.date`.

The types in `apps/web/src/modules/todo/types.ts` re-export `PostTodosMutationRequest` and `PatchTodosIdMutationRequest` directly — the fetchers accept `string` for `date` since `string` is assignable to `any`.

### 2. `action` type in audit logs (`GetAuditLogs200`)

kubb generates `action: string` instead of `"create" | "edit" | "delete"`. The manually typed `AuditLog.action` has the correct enum.

Workaround in `audit/hooks.ts`:

```ts
queryFn: () => getAuditLogsSuspense() as unknown as Promise<AuditLog[]>,
```

## Named schemas (components/schemas)

`app.ts` uses `transformObject: jsonSchemaTransformObject` in `fastifySwagger`. This makes Swagger read the Zod `globalRegistry` and populate `components/schemas` with all schemas registered via `.meta({ id, title })`.

When a response schema is inlined (no `$ref`), kubb generates inline types per operation — and when it encounters an enum inside an array of objects, it produces the wrong type (e.g. `GetTodos200 = StatusEnum[]` instead of `Todo[]`). The `.meta()` on the main entity schema prevents this: kubb sees `items: { $ref: '#/components/schemas/Todo' }` and generates `Todo[]` correctly.

Rule of thumb: every schema that represents the main entity of a module (e.g. `todoSchema`, `roleSchema`) must have `.meta({ id: "PascalCaseName", title: "PascalCaseName" })`. Request body schemas (`createFeatureSchema`, `updateFeatureSchema`) don't need it — they are not arrays and don't suffer from the collision.
