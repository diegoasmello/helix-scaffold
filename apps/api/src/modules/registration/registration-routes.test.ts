import { afterAll, describe, expect, it } from 'vitest'

import { createTestApp } from '@/test/helpers'

const app = createTestApp()

afterAll(async () => {
  await app.close()
})

describe('GET /registration/status', () => {
  it('returns open: true and providers: [] (test env has REGISTRATION_MODE=open, no social credentials)', async () => {
    const res = await app.inject({ method: 'GET', url: '/registration/status' })
    expect(res.statusCode).toBe(200)
    // No social credentials are set in the test env, so providers is always [].
    // Even if REGISTRATION_MODE were closed, providers would also be [].
    expect(res.json()).toEqual({ open: true, providers: [] })
  })
})
