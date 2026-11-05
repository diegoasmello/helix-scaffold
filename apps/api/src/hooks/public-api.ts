import type { FastifyCorsOptions } from '@fastify/cors'

import type { Config } from '@/config'
import { API_PREFIX } from '@/lib/api-prefix'

import type { FastifyTypedInstance } from '../types'
import { registerRateLimit } from './rate-limit'

type PublicApiSettings = Config['publicApi']

/** The public scope's prefix inside `API_PREFIX`: `/api/public/*`. */
export const PUBLIC_API_PREFIX = '/public'

const PUBLIC_PATH = `${API_PREFIX}${PUBLIC_API_PREFIX}`

/** Whether a request URL (path and query) is under `/api/public`. */
export function isPublicApiUrl(url: string): boolean {
  const path = url.split('?')[0]
  return path === PUBLIC_PATH || path.startsWith(`${PUBLIC_PATH}/`)
}

/**
 * The `Cache-Control` of an answer anyone may receive — the same for every
 * client, so a CDN may keep it for `cacheSeconds`.
 */
export function publicCacheControl(settings: PublicApiSettings): string {
  return settings.cacheSeconds > 0
    ? `public, max-age=${settings.cacheSeconds}`
    : 'no-cache'
}

/**
 * CORS for `/api/public/*`: the configured origins, `GET` only and never
 * credentials — the public API reads no cookie, so a browser on the site
 * must not send the admin's. No origin configured, no CORS header.
 */
export function publicCorsOptions(
  settings: PublicApiSettings
): FastifyCorsOptions {
  return {
    origin: settings.origins.length > 0 ? [...settings.origins] : false,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    credentials: false,
    maxAge: 86400,
  }
}

/**
 * Turns `scope` into the public API — `app.ts` registers it under
 * `PUBLIC_API_PREFIX` when `publicApi.enabled`, and the modules' public routes
 * inside it. Nothing in it reads the session: a route there answers the same
 * to everyone, so it may only return what a published record shows.
 *
 * - a rate limit per client IP (`publicApi.rateLimit`), 429 `rate_limited`;
 * - `Cache-Control: public, max-age=<cacheSeconds>` on a success, `no-store`
 *   on anything else (a 404 must not outlive the record's publication).
 */
export async function registerPublicApi(
  scope: FastifyTypedInstance,
  settings: PublicApiSettings
) {
  await registerRateLimit(scope, settings.rateLimit)

  scope.addHook('onSend', async (_request, reply, payload) => {
    reply.header(
      'cache-control',
      reply.statusCode < 300 ? publicCacheControl(settings) : 'no-store'
    )
    return payload
  })
}
