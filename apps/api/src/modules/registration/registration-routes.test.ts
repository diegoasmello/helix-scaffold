import { afterAll, describe, expect, it } from 'vitest'

import { createTestApp } from '@/test/helpers'

const app = createTestApp()

afterAll(async () => {
  await app.close()
})

describe('GET /registration/status', () => {
  it('returns 200 with open: true (test env sets REGISTRATION_MODE=open)', async () => {
    const res = await app.inject({ method: 'GET', url: '/registration/status' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ open: true })
  })

  it('does not require authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/registration/status' })
    expect(res.statusCode).not.toBe(401)
  })
})
