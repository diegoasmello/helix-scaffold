import { buildApp } from './app'
import { db } from './db'
import { env } from './env'

const app = buildApp(db)

app.listen({ port: 3333, host: '0.0.0.0' }).then(() => {
  console.log(`HTTP server running on ${env.BASE_URL}`)
  console.log(`Docs available at ${env.BASE_URL}/docs`)
})
