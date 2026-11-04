import { DomainError } from '@/lib/domain-errors'

interface AttemptLimiterOptions {
  /** Failures allowed per key before it is locked out. */
  maxFailures: number
  /** How long the failures count: the window starts at the first one. */
  windowMs: number
  /** For tests. */
  now?: () => number
}

/**
 * Counts failed attempts per key (a user id) and refuses further attempts
 * (429 `too_many_attempts`) once `maxFailures` is reached, until the window
 * started by the first failure ends. For checks better-auth does not throttle
 * because the server calls them (`auth.api.*` skips its rate limiter): the
 * current password asked by `PATCH /me/password` and `PATCH /me/email`.
 *
 * In memory, per process: a restart clears it, and several instances each
 * keep their own count — enough to stop an online guessing run from one
 * session; a cluster that needs a shared count stores it elsewhere (Redis).
 */
export function createAttemptLimiter(options: AttemptLimiterOptions) {
  const { maxFailures, windowMs, now = Date.now } = options
  const failures = new Map<string, { count: number; resetAt: number }>()

  function current(key: string) {
    const entry = failures.get(key)
    if (entry && entry.resetAt <= now()) {
      failures.delete(key)
      return undefined
    }
    return entry
  }

  /** Throws 429 `too_many_attempts` while `key` is locked out. */
  function assertAllowed(key: string): void {
    const entry = current(key)
    if (entry && entry.count >= maxFailures) {
      const minutes = Math.ceil((entry.resetAt - now()) / 60_000)
      throw new DomainError(
        429,
        'too_many_attempts',
        `Too many failed attempts. Try again in ${minutes} minute(s).`
      )
    }
  }

  function fail(key: string): void {
    const entry = current(key)
    if (entry) entry.count += 1
    else failures.set(key, { count: 1, resetAt: now() + windowMs })
  }

  /** A successful attempt clears the count. */
  function reset(key: string): void {
    failures.delete(key)
  }

  return { assertAllowed, fail, reset }
}
