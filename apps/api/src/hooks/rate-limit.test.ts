import { Writable } from 'node:stream'

import { fastify } from 'fastify'
import { describe, expect, it } from 'vitest'

import { registerDomainErrorHandler } from '@/lib/domain-errors'

import { registerRateLimit } from './rate-limit'

// A bare app with the limit, whose logs the test reads — whatever modules
// exist.
async function createLimitedApp(
  options: {
    trustProxy?: boolean | number
    allowList?: Parameters<typeof registerRateLimit>[1]['allowList']
  } = {}
) {
  const logs: { level: number; msg: string }[] = []
  const stream = new Writable({
    write(chunk, _encoding, done) {
      logs.push(JSON.parse(String(chunk)))
      done()
    },
  })
  const app = fastify({
    trustProxy: options.trustProxy ?? false,
    logger: { level: 'warn', stream },
  })
  registerDomainErrorHandler(app)
  await app.register(async (scope) => {
    await registerRateLimit(scope, {
      max: 2,
      windowSeconds: 60,
      allowList: options.allowList,
    })
    scope.get('/thing', async () => ({ ok: true }))
  })
  const warnings = () =>
    logs.filter((log) => log.level === 40 && /X-Forwarded-For/.test(log.msg))
  return { app, warnings }
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

  // Behind a proxy it does not trust, every client has the proxy's IP — and
  // shares one count.
  describe('a proxy server.trustProxy does not cover', () => {
    it('logs a warning, once', async () => {
      const { app, warnings } = await createLimitedApp()
      for (let i = 0; i < 2; i++) {
        await app.inject({
          method: 'GET',
          url: '/thing',
          headers: { 'x-forwarded-for': '203.0.113.7' },
        })
      }
      expect(warnings()).toHaveLength(1)
      await app.close()
    })

    it('stays quiet without X-Forwarded-For', async () => {
      const { app, warnings } = await createLimitedApp()
      await app.inject({ method: 'GET', url: '/thing' })
      expect(warnings()).toHaveLength(0)
      await app.close()
    })

    it('stays quiet when trustProxy trusts it', async () => {
      const { app, warnings } = await createLimitedApp({ trustProxy: 1 })
      await app.inject({
        method: 'GET',
        url: '/thing',
        headers: { 'x-forwarded-for': '203.0.113.7' },
      })
      expect(warnings()).toHaveLength(0)
      await app.close()
    })
  })
})
