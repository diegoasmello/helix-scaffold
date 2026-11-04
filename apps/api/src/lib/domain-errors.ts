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

/**
 * Answers `DomainError`s with their status and `{ message, code }`. Anything
 * else goes on to Fastify's default handler (validation 400s, 500s). Call it
 * before registering routes, so every plugin inherits it.
 */
export function registerDomainErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply
        .status(error.status)
        .send({ message: error.message, code: error.code })
    }
    throw error
  })
}
