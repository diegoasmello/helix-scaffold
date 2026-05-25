import './config/upload-references'

import { buildApp } from './app'
import { db } from './db'
import { env } from './env'
import { deleteOrphanUploads } from './lib/orphan-uploads'
import { createStorageProvider } from './lib/storage'
import { getUploadReferenceLoaders } from './lib/upload-references'

const app = buildApp(db)
const storage = createStorageProvider(env)

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000

app.listen({ port: 3333, host: '0.0.0.0' }).then(() => {
  console.log(`HTTP server running on ${env.BASE_URL}`)
  console.log(`Docs available at ${env.BASE_URL}/docs`)

  setInterval(async () => {
    try {
      const { deleted } = await deleteOrphanUploads(db, storage, getUploadReferenceLoaders())
      if (deleted > 0) {
        app.log.info(`Orphan upload cleanup: deleted ${deleted} uploads`)
      }
    } catch (err) {
      app.log.error({ err }, 'Orphan upload cleanup failed')
    }
  }, CLEANUP_INTERVAL_MS)
})
