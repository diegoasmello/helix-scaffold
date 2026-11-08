import { Writable } from 'node:stream'

import { fastify } from 'fastify'
import { describe, expect, it } from 'vitest'

import { registerUntrustedProxyWarning } from './untrusted-proxy-warning'

// A bare app with the warning and a route in a plugin of its own (like the
// modules'), whose logs the test reads.
async function createApp(trustProxy: boolean | number = false) {
  const logs: { level: number; msg: string }[] = []
  const stream = new Writable({
    write(chunk, _encoding, done) {
      logs.push(JSON.parse(String(chunk)))
      done()
    },
  })
  const app = fastify({ trustProxy, logger: { level: 'warn', stream } })
  registerUntrustedProxyWarning(app)
  await app.register(async (scope) => {
    scope.post('/auth/sign-in', async () => ({ ok: true }))
    scope.get('/thing', async () => ({ ok: true }))
  })
  const warnings = () =>
    logs.filter((log) => log.level === 40 && /X-Forwarded-For/.test(log.msg))
  return { app, warnings }
}

const proxied = { 'x-forwarded-for': '203.0.113.7' }

// Behind a proxy it does not trust, every client has the proxy's IP — and
// shares one count in every rate limit.
describe('registerUntrustedProxyWarning', () => {
  it('logs a warning, once, whatever the route', async () => {
    const { app, warnings } = await createApp()
    await app.inject({ method: 'POST', url: '/auth/sign-in', headers: proxied })
    await app.inject({ method: 'GET', url: '/thing', headers: proxied })
    expect(warnings()).toHaveLength(1)
    await app.close()
  })

  it('stays quiet without X-Forwarded-For', async () => {
    const { app, warnings } = await createApp()
    await app.inject({ method: 'GET', url: '/thing' })
    expect(warnings()).toHaveLength(0)
    await app.close()
  })

  it('stays quiet when trustProxy trusts it', async () => {
    const { app, warnings } = await createApp(1)
    await app.inject({ method: 'GET', url: '/thing', headers: proxied })
    expect(warnings()).toHaveLength(0)
    await app.close()
  })
})
