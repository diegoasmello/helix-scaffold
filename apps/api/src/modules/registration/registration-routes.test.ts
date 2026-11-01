import { afterAll, describe, expect, it } from 'vitest'

import { createTestApp } from '@/test/helpers'

const app = createTestApp()
// The mode app.config.ts ships with.
const closedApp = createTestApp({ registration: { mode: 'closed' } })

afterAll(async () => {
  await app.close()
  await closedApp.close()
})

describe('GET /registration/status', () => {
  it('returns open: true with a providers array (registration open in test config overrides)', async () => {
    const res = await app.inject({ method: 'GET', url: '/registration/status' })
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
      url: '/registration/status',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ open: false, providers: [] })
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
})
