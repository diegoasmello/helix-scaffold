import fastify from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  redactUrl,
  registerNotFoundHandler,
  serializeRequest,
} from './request-log'

describe('redactUrl', () => {
  it.each([
    [
      'the reset-password path token',
      '/api/auth/reset-password/abc123?callbackURL=%2Freset',
      '/api/auth/reset-password/[REDACTED]?callbackURL=%2Freset',
    ],
    [
      'the reset token redirected to an API route',
      '/api/x?token=abc123',
      '/api/x?token=[REDACTED]',
    ],
    [
      'token among other parameters',
      '/api/todos?page=2&token=abc&sortBy=title',
      '/api/todos?page=2&token=[REDACTED]&sortBy=title',
    ],
    [
      'the email-verification token',
      '/api/auth/verify-email?token=a.b.c&callbackURL=%2Fme',
      '/api/auth/verify-email?token=[REDACTED]&callbackURL=%2Fme',
    ],
    [
      'the OAuth code',
      '/api/auth/callback/google?state=s1&code=c1',
      '/api/auth/callback/google?state=s1&code=[REDACTED]',
    ],
    [
      'a token in the reset-password query',
      '/api/auth/reset-password?token=abc',
      '/api/auth/reset-password?token=[REDACTED]',
    ],
    [
      'a percent-encoded parameter name',
      '/api/x?%74oken=abc',
      '/api/x?%74oken=[REDACTED]',
    ],
  ])('redacts %s', (_case, url, expected) => {
    expect(redactUrl(url)).toBe(expected)
  })

  it.each([
    '/api/todos',
    '/api/todos?page=2&search=code+token',
    '/api/x?token',
    '/api/auth/reset-password',
  ])('keeps %s unchanged', (url) => {
    expect(redactUrl(url)).toBe(url)
  })
})

describe('request logs', () => {
  const lines: string[] = []
  const app = fastify({
    logger: {
      level: 'info',
      serializers: { req: serializeRequest },
      stream: { write: (line: string) => lines.push(line) },
    },
  })
  registerNotFoundHandler(app)
  app.get('/api/x', async () => ({ ok: true }))

  // Fastify's own 404, to compare with.
  const defaultApp = fastify()

  beforeEach(() => {
    lines.length = 0
  })

  afterAll(async () => {
    await app.close()
    await defaultApp.close()
  })

  it('logs a route URL with its token redacted', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/x?token=s3cr3t' })

    expect(res.statusCode).toBe(200)
    const incoming = lines
      .map((line) => JSON.parse(line))
      .find((entry) => entry.msg === 'incoming request')
    expect(incoming.req).toMatchObject({
      method: 'GET',
      url: '/api/x?token=[REDACTED]',
      remoteAddress: '127.0.0.1',
    })
    expect(lines.join('')).not.toContain('s3cr3t')
  })

  it.each([
    '/api/unknown?token=s3cr3t',
    '/api/auth/reset-password/s3cr3t?callbackURL=%2F',
  ])('logs the 404 of %s without the secret', async (url) => {
    const res = await app.inject({ method: 'GET', url })

    expect(res.statusCode).toBe(404)
    const messages = lines.map((line) => JSON.parse(line).msg)
    expect(messages).toContain(`Route GET:${redactUrl(url)} not found`)
    expect(lines.join('')).not.toContain('s3cr3t')
  })

  it("answers the 404 exactly as Fastify's default", async () => {
    const url = '/api/unknown?token=s3cr3t'
    const res = await app.inject({ method: 'GET', url })
    const expected = await defaultApp.inject({ method: 'GET', url })

    expect(res.statusCode).toBe(expected.statusCode)
    expect(res.headers['content-type']).toBe(expected.headers['content-type'])
    expect(res.json()).toEqual(expected.json())
  })
})
