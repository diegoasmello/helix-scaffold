// Postgres error codes the API maps to HTTP responses.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
export const PG_FOREIGN_KEY_VIOLATION = '23503'
export const PG_UNIQUE_VIOLATION = '23505'

/**
 * Reads the Postgres error code from a failed query. Drizzle wraps driver
 * errors, so the code may sit on the error itself or on its `cause`.
 */
export function getPgErrorCode(error: unknown): string | undefined {
  const err = error as { code?: unknown; cause?: { code?: unknown } } | null
  const code = err?.code ?? err?.cause?.code
  return typeof code === 'string' ? code : undefined
}
