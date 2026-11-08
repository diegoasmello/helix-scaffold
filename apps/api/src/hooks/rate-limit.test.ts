import { fastify } from 'fastify'
import { describe, expect, it } from 'vitest'

import { registerDomainErrorHandler } from '@/lib/domain-errors'

import { registerRateLimit } from './rate-limit'

// A bare app with the limit — whatever modules exist.
async function createLimitedApp(
  options: {
    allowList?: Parameters<typeof registerRateLimit>[1]['allowList']
  } = {}
) {
  const app = fastify()
  registerDomainErrorHandler(app)
  await app.register(async (scope) => {
    await registerRateLimit(scope, {
      max: 2,
      windowSeconds: 60,
      allowList: options.allowList,
    })
    scope.get('/thing', async () => ({ ok: true }))
  })
  return { app }
}

describe('registerRateLimit', () => {
  it('answers 429 rate_limited above the limit, per IP', async () => {
    const { app } = await createLimitedApp()
    const get = (remoteAddress: string) =>
      app.inject({ method: 'GET', url: '/thing', remoteAddress })
    expect((await get('10.0.0.1')).statusCode).toBe(200)
    expect((await get('10.0.0.1')).statusCode).toBe(200)
    const refused = await get('10.0.0.1')
    expect(refused.statusCode).toBe(429)
    expect(refused.json()).toEqual({
      message: 'Too many requests',
      code: 'rate_limited',
    })
    expect((await get('10.0.0.2')).statusCode).toBe(200)
    await app.close()
  })

  it('never counts what the allow list lets through', async () => {
    const { app } = await createLimitedApp({
      allowList: async (request) => request.headers['x-pass'] === 'yes',
    })
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/thing',
        headers: { 'x-pass': 'yes' },
      })
      expect(res.statusCode).toBe(200)
    }
    await app.close()
  })
})
