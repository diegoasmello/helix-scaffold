import type { FastifyInstance } from 'fastify'

/**
 * Logs a warning, once per process, the first time a request carries an
 * `X-Forwarded-For` that `server.trustProxy` ignored (its `request.ip` is
 * still the connection's): the sign of a reverse proxy the config does not
 * cover. Behind it every client has the proxy's IP, and every rate limit —
 * the sign-ins, `publicApi.rateLimit`, `uploads.rateLimit` — one count for
 * all of them. On the whole app, before any route: the sign-ins (better-auth's
 * own rate limit) trigger it as well as the scopes of `registerRateLimit()`.
 */
export function registerUntrustedProxyWarning(app: FastifyInstance) {
  let warned = false
  app.addHook('onRequest', async (request) => {
    if (
      !warned &&
      request.headers['x-forwarded-for'] &&
      request.ip === request.socket.remoteAddress
    ) {
      warned = true
      request.log.warn(
        'A request came through a proxy (X-Forwarded-For) that server.trustProxy does not trust: every client behind it shares its IP and one rate limit, sign-ins included. Set server.trustProxy in app.config.ts.'
      )
    }
  })
}
