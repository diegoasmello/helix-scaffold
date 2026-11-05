# The reference module (`todos`)

`todos` exists only to show every pattern a module can use — base CRUD, filters, normalized columns, slug, uploads (single file, attachments, images inside rich text), PDF export, a plan feature, the public API (publication and the routes a site reads) — on both sides, with its tests. It is not part of any product.

**In the scaffold**, the paths below are symlinks to the live module in `apps/`: it compiles, its tests run, and nothing here can drift from it. **In a product** built from the scaffold, `/start-project` replaced the links with copies and deleted the module from `apps/`. The copies are reading material: their imports point to paths that no longer exist, and nothing builds, lints or runs them. As the product grows, prefer one of its own modules of the same shape as the model; these files remain the example of each pattern no module of the product uses yet.

| Here | In the scaffold | Holds |
| --- | --- | --- |
| `api/` | `apps/api/src/modules/todos/` | schema, service, routes, route tests, the public API (`todos-public-schema.ts`, `todos-public-service.ts`, `todos-public-routes.ts` and its test), the PDF template (`templates/`), the module's `CLAUDE.md` |
| `schema/` | `apps/api/src/db/schema/todos.ts`, `todo-attachments.ts`, `todo-content-images.ts` | the tables, `TODO_NORMALIZED_FIELDS`, `TODO_SLUG`, `TODO_PUBLISHED` |
| `web/` | `apps/web/src/modules/todos/` | routes (list, create, edit, detail), `access.ts`, filters, the form, their tests, the module's `CLAUDE.md` |
| `locales/` | `apps/web/src/i18n/locales/{en,pt-BR}/todos.json` | the module's strings |
| `e2e/todos.spec.ts` | `apps/web/e2e/todos.spec.ts` | the reference spec of a module, and the plan gate journey |
| `seed-uploads.ts` | `apps/api/src/db/seed-uploads.ts` (only in a product — moved here) | `createSeedUploads()`: sample uploads for the seed, which only the module's sample rows used. Copy it back to `src/db/` for a module that seeds uploads |
| `wiring.diff` | — (written by `/start-project`) | how the module plugs into the shared files: every hunk the removal took out of them |

## Reading the docs

The docs name a `todos` file by its bare name (`todos-routes.ts`), by its scaffold path or by its path here; the table finds it in either place. In a product, a `todos` symbol the docs place in a **shared file** is in `wiring.diff`, with its surroundings:

| Shared file | Its `todos` part |
| --- | --- |
| `apps/api/src/app.ts` | the `todosRoutes` registration (with `requireSubscription` and `storage`); `todosPublicRoutes` in the public scope (which stays, empty) |
| `apps/api/src/config/permissions.ts` | the resource and its `PERMISSION_REQUIREMENTS` |
| `apps/api/src/config/upload-references.ts` | its four upload columns, read with `TODO_READERS` (the guard of `GET /todos/:id`), and the `isPublic` of the three its public schema returns |
| `apps/api/src/modules/uploads/uploads-schema.ts` | `publicUploadSchema` — an upload as a site sees it; bring it back for the product's first public module |
| `apps/api/src/config/test-overrides.ts`, `app.config.ts` | the `todos` feature in the plans |
| `apps/api/src/db/schema/index.ts`, `src/db/seed.ts` | the schema exports; the sample rows (slugs, normalized copies, uploads) and the roles' grants |
| `apps/api/src/test/helpers.ts` | `todoRow()`, `cleanupTodos()` |
| `apps/api/src/modules/uploads/upload-files-routes.test.ts` | the `describe.each` of its columns in _Who may read a file_, `describe("A todo's files on the public API")`, `attachToTodo()` |
| `apps/web/src/routes.ts`, `src/config/sidebar.ts` | the routes; the sidebar entry with its `+` shortcut |
| `apps/web/src/i18n/` | the namespace registration, `nav.todos`/`nav.createTodo`, the labels in `roles.json` and `subscription.json` |
| `apps/web/src/mocks/handlers.ts`, `src/lib/resource-cache.ts` (and its test) | the default MSW handlers; the cache entry and its keys |
| `apps/web/e2e/fixtures.ts` | `adminApi.createTodo()` — a fixture that needs uploads; `sampleFiles`, the files a spec puts in upload fields |

The removal also takes out what only the module used: `requireSubscription` in `app.ts` (no other route is gated by a plan feature) and the seed's `faker` import. `@faker-js/faker` itself stays for the seeds of the product's modules (`knip.json` lists it in `ignoreDependencies`, so it may go unused meanwhile).

**Searching in the scaffold:** ripgrep (and the tools built on it) does not follow symlinks — search `apps/`, where the live files are.
