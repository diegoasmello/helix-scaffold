import type { FastifyInstance } from 'fastify'
import z from 'zod'

/**
 * A failure the client can act on: thrown by services and route handlers,
 * answered by `registerDomainErrorHandler()` as `status` with
 * `{ message, code }`. `code` is stable (the frontend translates it —
 * `errors.<code>` in the module's locale); `message` is English, for logs and
 * API users.
 */
export class DomainError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 429,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

/**
 * Response schema for a status answered by `DomainError`s, documenting their
 * codes in the OpenAPI spec. Declare every such status in the route, or the
 * serializer rejects the response. `code` stays a string: the same status can
 * also carry Fastify's own codes (a 400 from body validation is
 * `FST_ERR_VALIDATION`).
 */
export function errorSchema(...codes: [string, ...string[]]) {
  return z.object({
    message: z.string(),
    code: z.string().describe(`One of: ${codes.join(', ')}`),
  })
}

const INTERNAL_ERROR = {
  statusCode: 500,
  error: 'Internal Server Error',
  message: 'Internal Server Error',
}

/**
 * Answers `DomainError`s with their status and `{ message, code }`. A client
 * error Fastify or a plugin raised (validation 400, 413, 429…) goes on to
 * Fastify's default handler, as is. Anything else is a bug or an outage: it
 * is logged whole and answered with a bare 500 — Fastify's default would send
 * its message, and Drizzle's carries the SQL and the query's values
 * (`Failed query: … params: …`). Call it before registering routes, so every
 * plugin inherits it.
 */
export function registerDomainErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply
        .status(error.status)
        .send({ message: error.message, code: error.code })
    }
    const { statusCode } = error as { statusCode?: number }
    if (statusCode !== undefined && statusCode < 500) throw error

    request.log.error({ err: error }, 'Unhandled error')
    return reply.status(500).send(INTERNAL_ERROR)
  })
}
