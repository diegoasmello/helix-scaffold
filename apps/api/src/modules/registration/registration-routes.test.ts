import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { user } from '@/db/schema'
import { createTestApp, testDb } from '@/test/helpers'

const app = createTestApp()
// The mode app.config.ts ships with.
const closedApp = createTestApp({ registration: { mode: 'closed' } })

afterAll(async () => {
  await app.close()
  await closedApp.close()
})

describe('GET /registration/status', () => {
  it('returns open: true with a providers array (registration open in test config overrides)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/registration/status',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.open).toBe(true)
    // providers reflects whichever social credentials are set in the test env
    expect(body.providers).toBeInstanceOf(Array)
  })
})

describe('closed registration', () => {
  it('reports registration as closed, with no social providers', async () => {
    const res = await closedApp.inject({
      method: 'GET',
      url: '/api/registration/status',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ open: false, providers: [], email: true })
  })

  it('rejects email sign-up with 403', async () => {
    const res = await closedApp.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: JSON.stringify({
        email: `closed-${crypto.randomUUID()}@test.com`,
        name: 'Closed',
        password: 'Password123!',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ message: 'Registration is closed' })
  })

  // `inject()` resolves the URL before sending it, so these paths go over a
  // real socket, byte for byte. Better Auth still routes each of them to
  // /sign-up/email.
  it.each([
    '/api/auth/./sign-up/email',
    '/api/auth/%2e/sign-up/email',
    '/api/auth/x/../sign-up/email',
  ])('rejects email sign-up reached through %s', async (path) => {
    if (!closedApp.server.listening) {
      await closedApp.listen({ port: 0, host: '127.0.0.1' })
    }
    const { port } = closedApp.server.address() as AddressInfo
    const email = `closed-${crypto.randomUUID()}@test.com`
    const body = JSON.stringify({
      email,
      name: 'Closed',
      password: 'Password123!',
    })

    const res = await new Promise<{ status?: number; body: string }>(
      (resolve, reject) => {
        const req = http.request(
          {
            host: '127.0.0.1',
            port,
            method: 'POST',
            path,
            headers: {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(body),
            },
          },
          (response) => {
            let data = ''
            response.setEncoding('utf8')
            response.on('data', (chunk) => (data += chunk))
            response.on('end', () =>
              resolve({ status: response.statusCode, body: data })
            )
          }
        )
        req.on('error', reject)
        req.end(body)
      }
    )

    expect(res.status).toBe(403)
    expect(JSON.parse(res.body)).toEqual({ message: 'Registration is closed' })
    const created = await testDb
      .select()
      .from(user)
      .where(eq(user.email, email))
    expect(created).toHaveLength(0)
  })
})
