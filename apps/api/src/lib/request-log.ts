import type { FastifyInstance, FastifyRequest } from 'fastify'

const REDACTED = '[REDACTED]'

/**
 * Query parameters that carry a secret on some URL the API receives:
 * better-auth's email-verification `token`, the password-reset `token` it adds
 * to the reset callback URL, and the OAuth authorization `code`.
 */
const SECRET_QUERY_PARAMS = new Set(['token', 'code'])

/** better-auth's emailed reset link: `/api/auth/reset-password/<token>`. */
const RESET_PASSWORD_TOKEN = /(\/reset-password\/)[^/?#]+/

/**
 * The URL as the logs may show it: the reset-password path token and the
 * values of `token` and `code` replaced by `[REDACTED]`, on every path — the
 * reset token is redirected to whatever callback URL the reset request named,
 * which can be any API route.
 */
export function redactUrl(url: string): string {
  const queryStart = url.indexOf('?')
  const rawPath = queryStart === -1 ? url : url.slice(0, queryStart)
  const path = rawPath.replace(RESET_PASSWORD_TOKEN, `$1${REDACTED}`)
  if (queryStart === -1) return path

  const query = url
    .slice(queryStart + 1)
    .split('&')
    .map((pair) => {
      const separator = pair.indexOf('=')
      if (separator === -1) return pair
      const name = pair.slice(0, separator)
      return SECRET_QUERY_PARAMS.has(decodeQueryName(name))
        ? `${name}=${REDACTED}`
        : pair
    })
    .join('&')
  return `${path}?${query}`
}

function decodeQueryName(name: string) {
  try {
    return decodeURIComponent(name.replace(/\+/g, ' '))
  } catch {
    return name
  }
}

/**
 * Fastify's default `req` log serializer (`fastify/lib/logger-pino.js`), with
 * the URL passed through `redactUrl()`. Some 404 paths hand it the raw Node
 * request, which lacks `host` and `ip`, as with the default.
 */
export function serializeRequest(req: FastifyRequest) {
  return {
    method: req.method,
    url: typeof req.url === 'string' ? redactUrl(req.url) : req.url,
    version: req.headers?.['accept-version'] as string | undefined,
    host: req.host,
    remoteAddress: req.ip,
    remotePort: req.socket?.remotePort,
  }
}

/**
 * Fastify's default 404 handler (`basic404` in `fastify/lib/four-oh-four.js`)
 * — same log level, status and body — but logging the URL through
 * `redactUrl()`: the default writes the raw URL into the log message, where
 * the `req` serializer never reaches it.
 */
export function registerNotFoundHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    const { method, url } = request
    request.log.info(`Route ${method}:${redactUrl(url)} not found`)
    reply.code(404).send({
      message: `Route ${method}:${url} not found`,
      error: 'Not Found',
      statusCode: 404,
    })
  })
}
