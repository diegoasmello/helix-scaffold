// Postgres error codes the API maps to HTTP responses.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
export const PG_FOREIGN_KEY_VIOLATION = '23503'
export const PG_UNIQUE_VIOLATION = '23505'

type PgErrorLike = {
  code?: unknown
  constraint?: unknown
  cause?: { code?: unknown; constraint?: unknown }
} | null

/**
 * Reads the Postgres error code from a failed query. Drizzle wraps driver
 * errors, so the code may sit on the error itself or on its `cause`.
 */
export function getPgErrorCode(error: unknown): string | undefined {
  const err = error as PgErrorLike
  const code = err?.code ?? err?.cause?.code
  return typeof code === 'string' ? code : undefined
}

/**
 * Name of the constraint or index that was violated — tells apart several
 * unique indexes on the same table (all of them raise `23505`).
 */
export function getPgErrorConstraint(error: unknown): string | undefined {
  const err = error as PgErrorLike
  const constraint = err?.constraint ?? err?.cause?.constraint
  return typeof constraint === 'string' ? constraint : undefined
}
