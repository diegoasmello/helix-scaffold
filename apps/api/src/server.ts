import './config/upload-references'

import { buildApp } from './app'
import { config } from './config'
import { db } from './db'
import { env } from './env'
import { deleteOrphanUploads } from './lib/orphan-uploads'
import { createStorageProvider } from './lib/storage'
import { getUploadReferenceLoaders } from './lib/upload-references'

const app = buildApp(db)
const storage = createStorageProvider(config.uploads, env.BASE_URL)

const { intervalHours, graceHours } = config.uploads.orphanCleanup
const CLEANUP_INTERVAL_MS = intervalHours * 60 * 60 * 1000

app.listen({ port: config.server.port, host: config.server.host }).then(() => {
  console.log(`HTTP server running on ${env.BASE_URL}`)
  console.log(`Docs available at ${env.BASE_URL}/docs`)

  setInterval(async () => {
    try {
      const { deleted } = await deleteOrphanUploads(
        db,
        storage,
        getUploadReferenceLoaders(),
        { graceHours }
      )
      if (deleted > 0) {
        app.log.info(`Orphan upload cleanup: deleted ${deleted} uploads`)
      }
    } catch (err) {
      app.log.error({ err }, 'Orphan upload cleanup failed')
    }
  }, CLEANUP_INTERVAL_MS)
})
