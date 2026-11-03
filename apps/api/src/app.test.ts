import fs from 'node:fs/promises'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { config } from '@/config'
import { createTestApp } from '@/test/helpers'

const app = createTestApp()

afterAll(async () => {
  await app.close()
})

// With the web on the same domain, the proxy routes `/api/*` here and every
// other path to the SPA — so nothing may answer outside the prefix.
describe('API prefix', () => {
  it('serves the endpoints under /api', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/registration/status',
    })
    expect(res.statusCode).toBe(200)
  })

  it.each(['/registration/status', '/subscription/status', '/docs'])(
    'answers 404 on %s without the prefix',
    async (url) => {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(404)
    }
  )

  it('declares /api as the spec server, with paths relative to it', async () => {
    await app.ready()
    const spec = app.swagger() as {
      servers: { url: string }[]
      paths: Record<string, unknown>
    }
    expect(spec.servers).toEqual([{ url: '/api' }])
    expect(spec.paths['/todos']).toBeDefined()
    expect(spec.paths['/api/todos']).toBeUndefined()
  })

  it('serves the docs under /api/docs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/' })
    expect(res.statusCode).toBe(200)
  })

  it('serves the uploaded files under /api/files', async () => {
    const name = `prefix-${crypto.randomUUID()}.txt`
    const file = path.join(config.uploads.dir, name)
    await fs.mkdir(config.uploads.dir, { recursive: true })
    await fs.writeFile(file, 'hello')

    try {
      const res = await app.inject({ method: 'GET', url: `/api/files/${name}` })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('hello')

      const unprefixed = await app.inject({
        method: 'GET',
        url: `/files/${name}`,
      })
      expect(unprefixed.statusCode).toBe(404)
    } finally {
      await fs.rm(file, { force: true })
    }
  })
})
