import { like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createAuth } from '@/auth'
import { config } from '@/config'
import { verification } from '@/db/schema'
import type { EmailProvider } from '@/lib/email'
import {
  cleanupAuth,
  createTestApp,
  createTestSession,
  testDb,
} from '@/test/helpers'

const app = createTestApp()
let authCookie = ''

beforeAll(async () => {
  await cleanupAuth()
  authCookie = await createTestSession(app)
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

/** A Cookie header carrying the cookies a response set. */
function cookieHeader(setCookie: string | string[] | undefined) {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

async function signIn(password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email: 'test@test.com', password },
  })
}

describe('password reset', () => {
  it('signs out every session of the account', async () => {
    // Another device — or an attacker holding a stolen session
    const otherCookie = cookieHeader(
      (await signIn('Password123!')).headers['set-cookie']
    )

    const resetRequest = await app.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      payload: { email: 'test@test.com' },
    })
    expect(resetRequest.statusCode).toBe(200)
    const [{ identifier }] = await testDb
      .select({ identifier: verification.identifier })
      .from(verification)
      .where(like(verification.identifier, 'reset-password:%'))
    const token = identifier.slice('reset-password:'.length)

    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, newPassword: 'NewPassword456!' },
    })
    expect(reset.statusCode).toBe(200)

    const getMe = (cookie: string) =>
      app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })
    expect((await getMe(authCookie)).statusCode).toBe(401)
    expect((await getMe(otherCookie)).statusCode).toBe(401)
    expect((await signIn('NewPassword456!')).statusCode).toBe(200)
  })

  it('answers without waiting for the email, so its timing does not reveal registered addresses', async () => {
    // A provider whose send never settles until the test says so: an awaited
    // send would hang the request below.
    let failSend: (error: Error) => void = () => {}
    const pendingProvider: EmailProvider = {
      send: () =>
        new Promise<void>((_, reject) => {
          failSend = reject
        }),
    }
    const logger = { error: vi.fn(), warn: vi.fn() }
    const auth = createAuth(testDb, pendingProvider, config, logger)

    const answer = await Promise.race([
      auth.api.requestPasswordReset({ body: { email: 'test@test.com' } }),
      new Promise((resolve) => setTimeout(() => resolve('timed out'), 2000)),
    ])
    expect(answer).toEqual(expect.objectContaining({ status: true }))

    failSend(new Error('Resend down'))
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to send password reset email'
      )
    )
  })
})
