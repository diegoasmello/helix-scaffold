#!/usr/bin/env node
// Removes the reference module (`todos`) from a product built on the scaffold,
// keeping it as reading material for `/new-module`:
//
//   1. checks that every edit below still applies — nothing is written if one
//      does not (`--check` stops here);
//   2. turns `.agents/skills/new-module/references/todos/` from links to the
//      live module into copies;
//   3. deletes the module's files and takes its wiring out of the shared files;
//   4. writes `references/todos/wiring.diff`, the hunks taken out of them;
//   5. formats the edited files, replaces the scaffold's migrations with one
//      `init` generated from the schema left (the product's history starts
//      without the module) and regenerates the API client.
//
// Run from the repository root: `node .agents/skills/start-project/scripts/remove-reference-module.mjs [--check]`.
// No dependency and no git history needed. The scaffold runs `--check` to know
// the edits still match its code.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const checkOnly = process.argv.includes('--check')
const REFERENCES = '.agents/skills/new-module/references/todos'

// --- the module's own files: deleted (their copies stay in REFERENCES) ---

const MODULE_PATHS = [
  'apps/api/src/modules/todos',
  'apps/api/src/db/schema/todos.ts',
  'apps/api/src/db/schema/todo-attachments.ts',
  'apps/api/src/db/schema/todo-content-images.ts',
  'apps/web/src/modules/todos',
  'apps/web/src/i18n/locales/en/todos.json',
  'apps/web/src/i18n/locales/pt-BR/todos.json',
  'apps/web/e2e/todos.spec.ts',
]

// Shared helpers only the module uses: moved into REFERENCES, so nothing is
// left unused (knip) and a later module can bring them back.
const MOVED_TO_REFERENCES = {
  'apps/api/src/db/seed-uploads.ts': 'seed-uploads.ts',
}

// --- the edits of the shared files ---
//
// `lines(regex, count)`  removes the lines matching `regex` — exactly `count`.
// `block(start, end)`    removes from `start` (found once) through the first
//                        `end` after it.
// `replace(find, by, n)` replaces `find`, found exactly `n` times (1).
// `rewrite(content, mustContain)` replaces the whole file, when it contains
//                        each of `mustContain`.

const lines = (regex, count) => ({ op: 'lines', regex, count })
const block = (start, end) => ({ op: 'block', start, end })
const replace = (find, by, count = 1) => ({ op: 'replace', find, by, count })
const rewrite = (content, mustContain) => ({ op: 'rewrite', content, mustContain })

const UPLOAD_REFERENCES = `// When a module adds columns or junction tables that reference uploads,
// register them here so orphan cleanup knows which uploads are still in use,
// and \`GET /files/*\` knows who may read their files — see
// \`src/modules/uploads/CLAUDE.md\` → _Adding uploads to another module_. The
// reference module's registrations are in
// \`.agents/skills/new-module/references/todos/wiring.diff\`.

export {}
`

const EDITS = {
  // --- apps/api ---
  'apps/api/src/app.ts': [
    lines(/^import \{ todosRoutes \} from '\.\/modules\/todos\/todos-routes'$/, 1),
    lines(/^import \{ todosPublicRoutes \} from '\.\/modules\/todos\/todos-public-routes'$/, 1),
    block('        authenticated.register(todosRoutes, {\n', '        })\n'),
    // The public scope stays, empty, for the product's first public module
    lines(/^ +publicApi\.register\(todosPublicRoutes, \{ database \}\)$/, 1),
    // The only route a plan feature gates is the module's
    lines(/^import \{ createRequireSubscription \} from '\.\/hooks\/require-subscription'$/, 1),
    lines(/^ +const requireSubscription = createRequireSubscription\(database, config\)$/, 1),
  ],
  'apps/api/src/db/schema/index.ts': [
    lines(/^export \* from '\.\/todo(s|-attachments|-content-images)'$/, 3),
  ],
  'apps/api/src/config/permissions.ts': [
    block("  {\n    resource: 'todos',\n", '  },\n'),
    block(
      '  // Image, file and one attachment are required on create.\n',
      "  'todos:delete': ['todos:view'],\n\n"
    ),
  ],
  // Only a public module returns uploads this way: it goes, and its first
  // public module brings it back from wiring.diff
  'apps/api/src/modules/uploads/uploads-schema.ts': [
    block(
      'const publicImageVariantSchema = z.object({ url: z.string() })\n',
      ".meta({ id: 'PublicUpload', title: 'PublicUpload' })\n\n"
    ),
  ],
  'apps/api/src/config/upload-references.ts': [
    rewrite(UPLOAD_REFERENCES, ['TODO_READERS', 'todoAttachments']),
  ],
  'apps/api/src/config/test-overrides.ts': [
    replace("features: ['todos', 'reports']", "features: ['reports']", 2),
  ],
  'apps/api/src/app.config.ts': [
    replace(
      "{ id: 'pro', name: 'Pro', features: ['todos'] }",
      "{ id: 'pro', name: 'Pro', features: [] }"
    ),
  ],
  'apps/api/src/db/seed.ts': [
    lines(/^import \{ faker \} from '@faker-js\/faker'$/, 1),
    lines(/^  (TODO_NORMALIZED_FIELDS|TODO_SLUG|todoAttachments|todos),$/, 4),
    lines(
      /^import \{ (normalizedValues|distinctSlugs|createStorageProvider) \} from '@\/lib\/[\w/-]+'$/,
      3
    ),
    lines(/^import \{ createSeedUploads \} from '\.\/seed-uploads'$/, 1),
    lines(/^  \{ resource: 'todos', action: '(view|create|edit|delete)' \},$/, 8),
    block('const TODO_COUNT = 50\n', 'const ATTACHMENTS_PER_TODO = 2\n\n'),
    block(
      "  console.log('Creating uploads...')\n",
      '  await db.insert(todoAttachments).values(attachmentValues)\n\n'
    ),
    replace(
      '`Seed complete: 3 roles, ${1 + EXTRA_USERS.length} users, ${TODO_COUNT} todos, ` +\n' +
        '      `${imageUploads.imageIds.length + fileUploads.fileIds.length + attachmentUploads.fileIds.length} uploads.`',
      '`Seed complete: 3 roles, ${1 + EXTRA_USERS.length} users.`'
    ),
  ],
  'apps/api/src/test/helpers.ts': [
    lines(/^  (TODO_NORMALIZED_FIELDS|TODO_SLUG|todos),$/, 3),
    lines(/^import \{ (normalizedValues|slugBase) \} from '@\/lib\/[\w-]+'$/, 2),
    block(
      'export async function cleanupTodos() {\n',
      '      `${slugBase(values.title, TODO_SLUG)}-${crypto.randomUUID().slice(0, 8)}`,\n  }\n}\n\n'
    ),
  ],
  'apps/api/src/modules/uploads/upload-files-routes.test.ts': [
    lines(
      /^import \{ (todoAttachments|todoContentImages|todos) \} from '@\/db\/schema\/todo[\w-]*'$/,
      3
    ),
    lines(/^  (cleanupTodos|todoRow),$/, 2),
    lines(/^  await cleanupTodos\(\)$/, 2),
    block(
      'type TodoReference =',
      '    await testDb.insert(todoContentImages).values({ todoId: todo.id, uploadId })\n  }\n}\n\n'
    ),
    block(
      "  // Each module's own columns, with the guard of its `GET` route\n",
      '    }\n  )\n\n'
    ),
    block(
      "// Each module's columns its public schema returns (`isPublic`), and those it\n",
      '\n})\n\n'
    ),
  ],

  // --- apps/web ---
  'apps/web/src/routes.ts': [
    lines(/^import \{ todosRoutes \} from '\.\/modules\/todos\/routes'$/, 1),
    lines(/^ +\.\.\.todosRoutes,$/, 1),
  ],
  'apps/web/src/config/sidebar.ts': [
    lines(/^  IconChecklist,$/, 1),
    lines(/^import \{ TODOS_ACCESS \} from '@\/modules\/todos\/routes\/access'$/, 1),
    block("  {\n    items: [\n      {\n        label: 'nav.todos',\n", '    ],\n  },\n'),
  ],
  'apps/web/src/i18n/index.ts': [
    lines(/^import todos(En|PtBR) from '\.\/locales\/[\w-]+\/todos\.json'$/, 2),
    lines(/^ +todos: todos(En|PtBR),$/, 2),
  ],
  'apps/web/src/i18n/types.d.ts': [
    lines(/^import type todos from '\.\/locales\/en\/todos\.json'$/, 1),
    lines(/^ +todos: typeof todos$/, 1),
  ],
  'apps/web/src/i18n/locales/en/common.json': [lines(/^ +"(todos|createTodo)": /, 2)],
  'apps/web/src/i18n/locales/pt-BR/common.json': [lines(/^ +"(todos|createTodo)": /, 2)],
  'apps/web/src/i18n/locales/en/roles.json': [lines(/^ +"todos": /, 1)],
  'apps/web/src/i18n/locales/pt-BR/roles.json': [lines(/^ +"todos": /, 1)],
  'apps/web/src/i18n/locales/en/subscription.json': [lines(/^ +"todos": /, 1)],
  'apps/web/src/i18n/locales/pt-BR/subscription.json': [lines(/^ +"todos": /, 1)],
  'apps/web/src/mocks/handlers.ts': [
    lines(/^  \w*Todos?\w*,$/, 11),
    block('  // Todos\n', '  deleteTodosIdHandler(() => deleteTodosIdHandlerResponse204()),\n\n'),
  ],
  'apps/web/src/lib/resource-cache.ts': [
    lines(/^  todos: \{ path: '\/todos', shownBy: \[\] \},$/, 1),
  ],
  'apps/web/src/lib/resource-cache.test.ts': [
    lines(/^  getTodos(Id)?SuspenseQueryKey,$/, 2),
    lines(/^  todo(sPage|1): getTodos/, 2),
    block("    expect(detailQueryKey('todos', '1')).toEqual(\n", '    )\n'),
    block("\n  it('leaves other resources alone', async () => {\n", '  })\n'),
  ],
  'apps/web/e2e/fixtures.ts': [
    lines(/^  PostTodos(201|MutationRequest),$/, 2),
    block(
      '  /** A todo with the image, PDF and attachment its form requires. */\n',
      '    } satisfies PostTodosMutationRequest)\n  }\n\n'
    ),
    lines(/^    createTodo,$/, 1),
    // Only the module's spec uploads files (its copy keeps using them)
    block('/**\n * Files for upload fields', ' */\n'),
    block('export const sampleFiles = {\n', '} satisfies Record<string, SampleFile>\n\n'),
    replace('`pro` and `enterprise` unlock `todos`.', '`pro` and `enterprise` unlock the rest.'),
  ],
}

// --- applying an edit to a file's text ---

function apply(text, edit) {
  switch (edit.op) {
    case 'lines': {
      const all = text.split('\n')
      const kept = all.filter((line) => !edit.regex.test(line))
      const removed = all.length - kept.length
      if (removed !== edit.count) {
        throw new Error(`${edit.regex} matched ${removed} lines, expected ${edit.count}`)
      }
      return kept.join('\n')
    }
    case 'block': {
      const start = text.indexOf(edit.start)
      if (start === -1 || text.indexOf(edit.start, start + 1) !== -1) {
        throw new Error(`block start ${JSON.stringify(edit.start)} not found exactly once`)
      }
      const end = text.indexOf(edit.end, start + edit.start.length)
      if (end === -1) throw new Error(`block end ${JSON.stringify(edit.end)} not found`)
      return text.slice(0, start) + text.slice(end + edit.end.length)
    }
    case 'replace': {
      const found = text.split(edit.find).length - 1
      if (found !== edit.count) {
        throw new Error(`${JSON.stringify(edit.find)} found ${found} times, expected ${edit.count}`)
      }
      return text.split(edit.find).join(edit.by)
    }
    case 'rewrite': {
      const missing = edit.mustContain.filter((part) => !text.includes(part))
      if (missing.length > 0) throw new Error(`expected ${missing.join(', ')} in the file`)
      return edit.content
    }
  }
}

// A JSON file whose last entry lost its line keeps a dangling comma.
function fixJson(file, text) {
  const fixed = text.replace(/,(\s*[}\]])/g, '$1')
  JSON.parse(fixed)
  return fixed
}

// --- 1. every edit, in memory ---

const problems = []
const isLink = (p) => fs.lstatSync(path.join(root, p), { throwIfNoEntry: false })?.isSymbolicLink()

if (!fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) {
  problems.push('run it from the repository root')
} else {
  for (const p of MODULE_PATHS) {
    if (!fs.existsSync(path.join(root, p))) problems.push(`${p}: not found — already removed?`)
  }
  for (const p of Object.keys(MOVED_TO_REFERENCES)) {
    if (!fs.existsSync(path.join(root, p))) problems.push(`${p}: not found`)
  }
  if (!isLink(`${REFERENCES}/api`)) problems.push(`${REFERENCES}/api: expected a link to the live module`)
}

const originals = {}
const results = {}
for (const [file, edits] of Object.entries(EDITS)) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) {
    problems.push(`${file}: not found`)
    continue
  }
  let text = fs.readFileSync(full, 'utf8')
  originals[file] = text
  try {
    for (const edit of edits) text = apply(text, edit)
    if (file.endsWith('.json')) text = fixJson(file, text)
    if (!checkOnly && /todo/i.test(text) && !file.endsWith('upload-references.ts')) {
      const left = text.split('\n').filter((line) => /todo/i.test(line))
      console.warn(`note: ${file} still mentions todos:\n  ${left.join('\n  ')}`)
    }
    results[file] = text
  } catch (error) {
    problems.push(`${file}: ${error.message}`)
  }
}

if (problems.length > 0) {
  console.error('The removal does not apply — nothing was changed:\n- ' + problems.join('\n- '))
  process.exit(1)
}
if (checkOnly) {
  console.log(`Every edit applies (${Object.keys(EDITS).length} shared files).`)
  process.exit(0)
}

// --- 2. the references become copies ---

// `fs.cpSync`'s `dereference` keeps nested links: walk them by hand.
function copyFollowingLinks(from, to) {
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true })
    for (const entry of fs.readdirSync(from)) {
      copyFollowingLinks(path.join(from, entry), path.join(to, entry))
    }
  } else {
    fs.copyFileSync(from, to)
  }
}

function findLinks(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) found.push(full)
    else if (entry.isDirectory()) findLinks(full, found)
  }
  return found
}

// The copy is built next to the links, not in the system's temp dir: `rename`
// cannot cross file systems (a tmpfs `/tmp` fails with EXDEV). The links are
// moved aside, not deleted, until the copy is in place — on any failure they
// go back, and the copy goes.
const referencesDir = path.join(root, REFERENCES)
const copy = fs.mkdtempSync(path.join(path.dirname(referencesDir), '.todos-copy-'))
const linksAside = `${copy}-links`
try {
  copyFollowingLinks(referencesDir, copy)
  for (const [from, to] of Object.entries(MOVED_TO_REFERENCES)) {
    fs.copyFileSync(path.join(root, from), path.join(copy, to))
  }
  const links = findLinks(copy)
  if (links.length > 0) throw new Error(`links left in the copy: ${links.join(', ')}`)
  fs.renameSync(referencesDir, linksAside)
  fs.renameSync(copy, referencesDir)
} catch (error) {
  // Moved aside and the copy not in place: the links go back
  if (fs.existsSync(linksAside) && !fs.existsSync(referencesDir)) {
    fs.renameSync(linksAside, referencesDir)
  }
  fs.rmSync(copy, { recursive: true, force: true })
  console.error(`Could not turn ${REFERENCES} into copies — nothing was changed:\n${error.message}`)
  process.exit(1)
}
fs.rmSync(linksAside, { recursive: true })

// --- 3. the module goes, its wiring with it ---

for (const p of [...MODULE_PATHS, ...Object.keys(MOVED_TO_REFERENCES)]) {
  fs.rmSync(path.join(root, p), { recursive: true })
}
for (const [file, text] of Object.entries(results)) {
  fs.writeFileSync(path.join(root, file), text)
}

// --- 5a. formatting, before the diff, so it shows what a reader would write ---

const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' })

const byWorkspace = {}
for (const file of Object.keys(results)) {
  const [, workspace] = file.match(/^(apps\/[\w-]+)\//)
  ;(byWorkspace[workspace] ??= []).push(path.relative(workspace, file))
}
for (const [workspace, files] of Object.entries(byWorkspace)) {
  const code = files.filter((file) => /\.(ts|tsx)$/.test(file))
  if (code.length > 0) {
    run('pnpm', ['exec', 'prettier', '--write', '--log-level', 'warn', ...code], path.join(root, workspace))
  }
}

// --- 4. wiring.diff: the hunks taken out of the shared files ---

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wiring-'))
let diff = ''
for (const [file, before] of Object.entries(originals)) {
  const a = path.join(scratch, 'a')
  const b = path.join(root, file)
  fs.writeFileSync(a, before)
  try {
    execFileSync('git', ['diff', '--no-index', '--no-color', '--', a, b], { encoding: 'utf8' })
  } catch (error) {
    // `git diff` exits 1 when the files differ: the diff is its output
    diff += error.stdout
      .replace(/^diff --git .*$/m, `diff --git a/${file} b/${file}`)
      .replace(/^index .*\n/m, '')
      .replace(/^--- .*$/m, `--- a/${file}`)
      .replace(/^\+\+\+ .*$/m, `+++ b/${file}`)
  }
}
fs.rmSync(scratch, { recursive: true })
fs.writeFileSync(
  path.join(referencesDir, 'wiring.diff'),
  `# How the reference module was wired into the shared files: the hunks
# remove-reference-module.mjs took out when it removed \`todos\` (see README.md).
# A new module adds its own lines at the same places.

${diff}`
)

// --- 5b. the database migrations and the API client ---

// The product starts its history here: the scaffold's migrations (the
// module's tables included) give way to a single `init` drizzle-kit generates
// from the schema left. A database migrated before this point does not match
// it and is recreated (SKILL.md → Phase 3).
fs.rmSync(path.join(root, 'apps/api/src/db/migrations'), { recursive: true })
run('pnpm', ['--filter', 'api', 'db:generate', '--name', 'init'])
run('pnpm', ['spec:sync'])

console.log(`
The reference module is removed. Its copy and wiring.diff are in ${REFERENCES}/.
The migrations are now a single init without it.
Next: pnpm db:recreate:test && pnpm db:migrate, then pnpm type-check, pnpm lint,
pnpm test and pnpm knip.`)
