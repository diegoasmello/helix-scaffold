import { reset } from 'drizzle-seed'

import { db } from '@/db'
import * as schema from '@/db/schema'

async function main() {
  await reset(db, schema)
  console.log('Database reset complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
