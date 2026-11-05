import fastifyRateLimit from '@fastify/rate-limit'
import type { FastifyRequest } from 'fastify'

import { DomainError } from '@/lib/domain-errors'

import type { FastifyTypedInstance } from '../types'

interface RateLimitSettings {
  /** Requests one client IP may make per window. */
  max: number
  windowSeconds: number
  /** Requests it never counts (a signed-in user on `GET /files/*`). */
  allowList?: (request: FastifyRequest) => Promise<boolean>
}

/**
 * Limits every route of `scope` (and of the plugins it registers) to `max`
 * requests per client IP per window, before the handler or any query runs.
 * Above it: 429 `{ message, code: 'rate_limited' }` with `Retry-After`.
 * Counted in memory, per process and per scope. For routes that answer
 * anonymous requests: the public API (`registerPublicApi()`) and
 * `GET /files/*`.
 *
 * The client IP is `request.ip`: behind a reverse proxy, without
 * `server.trustProxy`, it is the proxy's for everyone, and every client
 * shares one count. A request whose `X-Forwarded-For` was ignored (its IP is
 * still the connection's) — the sign of a proxy `trustProxy` does not cover —
 * logs a warning, once.
 */
export async function registerRateLimit(
  scope: FastifyTypedInstance,
  settings: RateLimitSettings
) {
  // Logged once per scope, not per request.
  let warnedAboutProxy = false
  scope.addHook('onRequest', async (request) => {
    if (
      !warnedAboutProxy &&
      request.headers['x-forwarded-for'] &&
      request.ip === request.socket.remoteAddress
    ) {
      warnedAboutProxy = true
      request.log.warn(
        'A request came through a proxy (X-Forwarded-For) that server.trustProxy does not trust: every client behind it shares its IP and one rate limit. Set server.trustProxy in app.config.ts.'
      )
    }
  })

  await scope.register(fastifyRateLimit, {
    max: settings.max,
    timeWindow: settings.windowSeconds * 1000,
    allowList: settings.allowList,
    // Thrown, so the domain error handler answers `{ message, code }`.
    errorResponseBuilder: () =>
      new DomainError(429, 'rate_limited', 'Too many requests'),
  })
}
