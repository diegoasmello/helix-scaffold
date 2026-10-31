// Writes the OpenAPI spec that `@helix/api-client` is generated from, with
// every optional route registered (see `src/config/spec-overrides.ts`).
// Needs no running server, database or `.env`: building the app opens no
// connection, so the variables below only have to pass `src/env.ts`.
//
// Usage: tsx src/scripts/export-spec.ts <output file>

import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { enableSpecExport } from '@/config/spec-overrides'

const [outFile] = process.argv.slice(2)
if (!outFile) {
  console.error('Usage: pnpm --filter api spec:export <output file>')
  process.exit(1)
}

process.env.DATABASE_URL ??= 'postgres://spec:spec@localhost:5432/spec'
process.env.AUTH_SECRET ??= randomBytes(32).toString('base64')
process.env.BASE_URL ??= 'http://localhost:3333'
process.env.CLIENT_URL ??= 'http://localhost:5173'

enableSpecExport()

// Imported only now: `@/config` resolves on first import and must see the flag.
const { buildApp } = await import('@/app')
const { db } = await import('@/db')

// The billing webhook is hidden from the spec, so no adapter is needed.
const app = buildApp(db, { billingWebhookAdapter: null })
await app.ready()

const target = path.resolve(outFile)
await writeFile(target, JSON.stringify(app.swagger()))
await app.close()

console.log(`OpenAPI spec written to ${target}`)
