#!/usr/bin/env node
// Renames what has to carry the product's name — and only that: the local
// databases (`helix`, `helix_test`, `helix_e2e`), the temporary upload dirs of
// the test suites (two products on one machine would share them), the root
// package and the color scheme's localStorage key. The `@helix/*` package
// scope and the `--helix-*` CSS variables are internal names and stay.
//
// Run from the repository root, before the databases are first started (their
// names are set when a volume is created):
//   node .agents/skills/start-project/scripts/rename-product.mjs <slug> [--check]
// `<slug>`: lowercase letters, digits and `_`, starting with a letter (`acme`).
// Nothing is written if a replacement does not apply.

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const slug = args.find((arg) => !arg.startsWith('--'))

if (!slug || !/^[a-z][a-z0-9_]*$/.test(slug)) {
  console.error('Usage: rename-product.mjs <slug> [--check] — slug: [a-z][a-z0-9_]*')
  process.exit(1)
}

// Everywhere (code and docs): names that are only ever these.
const EVERYWHERE = [
  { find: /\bhelix_(test|e2e)\b/g, by: `${slug}_$1` },
  { find: /\/tmp\/helix-(test|e2e)-uploads\b/g, by: `/tmp/${slug}-$1-uploads` },
  { find: /(localhost:\d+)\/helix\b(?!_)/g, by: `$1/${slug}` },
]

// One file each: the bare `helix` where it names the dev database or the repo.
const IN_FILE = {
  'docker-compose.yml': [{ find: /^(\s+POSTGRES_DB: )helix$/m, by: `$1${slug}` }],
  'package.json': [{ find: /^(\s+"name": )"helix",$/m, by: `$1"${slug}",` }],
  'apps/web/src/main.tsx': [
    { find: /key: 'helix-color-scheme'/, by: `key: '${slug}-color-scheme'` },
  ],
  'CLAUDE.md': [{ find: /`db` → `helix` on port/, by: `\`db\` → \`${slug}\` on port` }],
  'README.md': [{ find: /\| `helix`( *)\|/, by: `| \`${slug}\`$1|` }],
}

// What must be gone afterwards
const LEFTOVERS = /\bhelix_(test|e2e)\b|\/tmp\/helix-|localhost:\d+\/helix\b|POSTGRES_DB: helix\b|'helix-color-scheme'/

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.turbo', 'generated', 'coverage', 'test-results', 'playwright-report'])
const TEXT = /\.(ts|tsx|js|mjs|cjs|json|md|ya?ml|html|css|sql|example|test)$|^\.env/

function* textFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue // the reference module's links: renamed through their targets
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // This skill names `helix` on purpose, and goes away when it is done
      if (!SKIP_DIRS.has(entry.name) && path.relative(root, full) !== '.agents/skills/start-project') {
        yield* textFiles(full)
      }
    } else if (TEXT.test(entry.name) && entry.name !== 'pnpm-lock.yaml') {
      yield full
    }
  }
}

const problems = []
const results = new Map()
let replaced = 0

for (const full of textFiles(root)) {
  const file = path.relative(root, full)
  let text = fs.readFileSync(full, 'utf8')
  const before = text
  for (const { find, by } of EVERYWHERE) {
    replaced += text.match(find)?.length ?? 0
    text = text.replace(find, by)
  }
  for (const { find, by } of IN_FILE[file] ?? []) {
    if (!find.test(text)) problems.push(`${file}: ${find} not found`)
    replaced += 1
    text = text.replace(find, by)
  }
  if (text !== before) results.set(full, text)
}
for (const file of Object.keys(IN_FILE)) {
  if (!fs.existsSync(path.join(root, file))) problems.push(`${file}: not found`)
}
for (const [full, text] of results) {
  const left = text.split('\n').filter((line) => LEFTOVERS.test(line))
  if (left.length > 0) problems.push(`${path.relative(root, full)}: still ${left.join(' | ')}`)
}

if (problems.length > 0) {
  console.error('The rename does not apply — nothing was changed:\n- ' + problems.join('\n- '))
  process.exit(1)
}
if (checkOnly) {
  console.log(`${replaced} replacements in ${results.size} files would apply.`)
  process.exit(0)
}
for (const [full, text] of results) fs.writeFileSync(full, text)
console.log(`Renamed to "${slug}": ${replaced} replacements in ${results.size} files.`)
