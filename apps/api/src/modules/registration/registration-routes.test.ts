import { afterAll, describe, expect, it } from 'vitest'

import { createTestApp } from '@/test/helpers'

const app = createTestApp()

afterAll(async () => {
  await app.close()
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
