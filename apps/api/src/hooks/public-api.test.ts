import { fastify } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { afterAll, describe, expect, it } from 'vitest'

import { config, overrideConfig } from '@/config'
import { env } from '@/env'
import { registerDomainErrorHandler } from '@/lib/domain-errors'
import { createTestApp } from '@/test/helpers'

import {
  isPublicApiUrl,
  PUBLIC_API_PREFIX,
  publicCorsOptions,
  registerPublicApi,
} from './public-api'

// The public scope as `app.ts` builds it, on a bare route of the test's own —
// whatever modules exist.
function createPublicApp(
  publicApi: Parameters<typeof overrideConfig>[1]['publicApi'] = {}
) {
  const settings = overrideConfig(config, { publicApi }).publicApi
  const app = fastify().withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  registerDomainErrorHandler(app)
  app.register(
    async (scope) => {
      await registerPublicApi(scope, settings)
      scope.get('/thing', async () => ({ ok: true }))
      scope.get('/missing', async (_request, reply) =>
        reply.status(404).send({ message: 'Not found' })
      )
    },
    { prefix: `/api${PUBLIC_API_PREFIX}` }
  )
  return app
}

describe('isPublicApiUrl', () => {
  it.each([
    ['/api/public', true],
    ['/api/public/todos', true],
    ['/api/public/todos/a-slug?x=1', true],
    ['/api/publications', false],
    ['/api/todos', false],
    ['/public/todos', false],
    ['/api/files/public/x.png', false],
  ])('%s → %s', (url, expected) => {
    expect(isPublicApiUrl(url)).toBe(expected)
  })
})

describe('publicCorsOptions', () => {
  it('allows the configured origins, GET only, without credentials', () => {
    expect(
      publicCorsOptions({
        ...config.publicApi,
        origins: ['https://site.example'],
      })
    ).toMatchObject({
      origin: ['https://site.example'],
      methods: ['GET', 'HEAD', 'OPTIONS'],
      credentials: false,
    })
  })

  it('sends no CORS header without origins', () => {
    expect(publicCorsOptions({ ...config.publicApi, origins: [] }).origin).toBe(
      false
    )
  })
})

describe('registerPublicApi', () => {
  const app = createPublicApp({ cacheSeconds: 120 })

  afterAll(async () => {
    await app.close()
  })

  it('lets a CDN keep a success for cacheSeconds', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/public/thing' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=120')
  })

  it('never lets anything else be kept', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/public/missing' })
    expect(res.statusCode).toBe(404)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('sends no-cache with cacheSeconds 0', async () => {
    const uncached = createPublicApp({ cacheSeconds: 0 })
    try {
      const res = await uncached.inject({
        method: 'GET',
        url: '/api/public/thing',
      })
      expect(res.headers['cache-control']).toBe('no-cache')
    } finally {
      await uncached.close()
    }
  })

  it('answers 429 rate_limited above the limit, per IP', async () => {
    const limited = createPublicApp({
      rateLimit: { max: 2, windowSeconds: 60 },
    })
    try {
      const get = (remoteAddress: string) =>
        limited.inject({
          method: 'GET',
          url: '/api/public/thing',
          remoteAddress,
        })
      expect((await get('10.0.0.1')).statusCode).toBe(200)
      expect((await get('10.0.0.1')).statusCode).toBe(200)
      const refused = await get('10.0.0.1')
      expect(refused.statusCode).toBe(429)
      expect(refused.json()).toEqual({
        message: 'Too many requests',
        code: 'rate_limited',
      })
      expect(refused.headers['retry-after']).toBeDefined()
      expect(refused.headers['cache-control']).toBe('no-store')
      // Another client keeps its own count.
      expect((await get('10.0.0.2')).statusCode).toBe(200)
    } finally {
      await limited.close()
    }
  })
})

// The CORS of `app.ts`: one policy for the web, another for the public API.
describe('CORS', () => {
  const site = 'https://site.example'
  const app = createTestApp({ publicApi: { origins: [site] } })

  afterAll(async () => {
    await app.close()
  })

  function preflight(url: string, origin: string) {
    return app.inject({
      method: 'OPTIONS',
      url,
      headers: { origin, 'access-control-request-method': 'GET' },
    })
  }

  it("allows the site's origin on the public API, without credentials", async () => {
    const res = await preflight('/api/public/anything', site)
    expect(res.headers['access-control-allow-origin']).toBe(site)
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
    expect(res.headers['access-control-allow-methods']).toBe(
      'GET, HEAD, OPTIONS'
    )
  })

  // The web's policy names its one origin, which the browser compares.
  it("refuses the site's origin everywhere else", async () => {
    const res = await preflight('/api/registration/status', site)
    expect(res.headers['access-control-allow-origin']).toBe(env.CLIENT_URL)
  })

  it('allows the web with its credentials outside the public API', async () => {
    const res = await preflight('/api/registration/status', env.CLIENT_URL)
    expect(res.headers['access-control-allow-origin']).toBe(env.CLIENT_URL)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('gives the web no credentials on the public API', async () => {
    const res = await preflight('/api/public/anything', env.CLIENT_URL)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
  })
})
