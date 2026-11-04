import { describe, expect, it } from 'vitest'

import { createAttemptLimiter } from './attempt-limiter'
import { DomainError } from './domain-errors'

function setup() {
  let time = 0
  const limiter = createAttemptLimiter({
    maxFailures: 3,
    windowMs: 60_000,
    now: () => time,
  })
  return { limiter, advance: (ms: number) => (time += ms) }
}

function refusal(fn: () => void) {
  try {
    fn()
  } catch (error) {
    return error
  }
  return undefined
}

describe('createAttemptLimiter', () => {
  it('allows attempts until the limit, then refuses with 429 too_many_attempts', () => {
    const { limiter } = setup()
    for (let i = 0; i < 3; i++) {
      limiter.assertAllowed('u1')
      limiter.fail('u1')
    }
    const error = refusal(() => limiter.assertAllowed('u1'))
    expect(error).toBeInstanceOf(DomainError)
    expect(error).toMatchObject({ status: 429, code: 'too_many_attempts' })
    expect((error as Error).message).toContain('1 minute')
  })

  it('counts each key on its own', () => {
    const { limiter } = setup()
    for (let i = 0; i < 3; i++) limiter.fail('u1')
    expect(() => limiter.assertAllowed('u2')).not.toThrow()
  })

  it('lets the key in again once the window started by the first failure ends', () => {
    const { limiter, advance } = setup()
    limiter.fail('u1')
    advance(30_000)
    limiter.fail('u1')
    limiter.fail('u1')
    expect(() => limiter.assertAllowed('u1')).toThrow(DomainError)
    advance(30_000)
    expect(() => limiter.assertAllowed('u1')).not.toThrow()
    limiter.fail('u1')
    expect(() => limiter.assertAllowed('u1')).not.toThrow()
  })

  it('clears the count on reset', () => {
    const { limiter } = setup()
    for (let i = 0; i < 3; i++) limiter.fail('u1')
    limiter.reset('u1')
    expect(() => limiter.assertAllowed('u1')).not.toThrow()
  })
})
