import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createAuth } from '@/auth'
import { config } from '@/config'
import { session, user, verification } from '@/db/schema'
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

describe('email templates', () => {
  it('escapes the change-email link, so a crafted callbackURL cannot inject HTML', async () => {
    const sent: string[] = []
    const capturingProvider: EmailProvider = {
      send: async (_to, _subject, html) => {
        sent.push(html)
      },
    }
    const auth = createAuth(testDb, capturingProvider, config)

    const email = `templates-${Date.now()}@test.com`
    const signUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, name: 'Templates', password: 'Password123!' },
    })
    expect(signUp.statusCode).toBe(200)
    await testDb
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.email, email))

    await auth.api.changeEmail({
      body: {
        newEmail: `new-${email}`,
        callbackURL: '/me"><h1>Your account is locked</h1><a href="x',
      },
      headers: new Headers({
        cookie: cookieHeader(signUp.headers['set-cookie']),
      }),
    })

    await vi.waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]).not.toContain('<h1>')
    expect(sent[0]).toContain('&quot;&gt;&lt;h1&gt;')
  })
})

describe('client IP', () => {
  /** The IP better-auth recorded on the session a sign-in opened. */
  async function sessionIp(testApp: typeof app, forwardedFor: string) {
    const email = `ip-${crypto.randomUUID()}@test.com`
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, name: 'IP', password: 'Password123!' },
    })
    const res = await testApp.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password: 'Password123!' },
      headers: { 'x-forwarded-for': forwardedFor },
    })
    expect(res.statusCode).toBe(200)
    const token = decodeURIComponent(
      cookieHeader(res.headers['set-cookie']).split('=')[1]
    ).split('.')[0]
    const [row] = await testDb
      .select({ ipAddress: session.ipAddress })
      .from(session)
      .where(eq(session.token, token))
    return row.ipAddress
  }

  it("ignores the client's X-Forwarded-For by default, so it cannot dodge the sign-in rate limit", async () => {
    // `inject` connects from 127.0.0.1
    expect(await sessionIp(app, '203.0.113.9')).toBe('127.0.0.1')
  })

  it('takes the forwarded IP when server.trustProxy trusts the proxy', async () => {
    const proxied = createTestApp({ server: { trustProxy: true } })
    try {
      expect(await sessionIp(proxied, '203.0.113.9')).toBe('203.0.113.9')
    } finally {
      await proxied.close()
    }
  })
})

describe('account linking', () => {
  it('never links a social sign-in to an existing account by email alone', () => {
    // An unverified email sign-up must not gain the account a social sign-in
    // with the same address opens; linking happens only through `linkSocial`.
    const auth = createAuth(testDb, { send: async () => {} }, config)
    expect(auth.options.account?.accountLinking).toMatchObject({
      disableImplicitLinking: true,
    })
  })
})

describe('change-email verification', () => {
  it('answers without waiting for the email, so its timing does not reveal a taken address', async () => {
    // better-auth sends nothing for an address another account holds, so an
    // awaited send would make a free address answer slower.
    let failSend: (error: Error) => void = () => {}
    const pendingProvider: EmailProvider = {
      send: () =>
        new Promise<void>((_, reject) => {
          failSend = reject
        }),
    }
    const logger = { error: vi.fn(), warn: vi.fn() }
    const auth = createAuth(testDb, pendingProvider, config, logger)

    const email = `verify-${crypto.randomUUID()}@test.com`
    const signUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, name: 'Verify', password: 'Password123!' },
    })
    const answer = await Promise.race([
      auth.api.changeEmail({
        body: { newEmail: `new-${email}` },
        headers: new Headers({
          cookie: cookieHeader(signUp.headers['set-cookie']),
        }),
      }),
      new Promise((resolve) => setTimeout(() => resolve('timed out'), 2000)),
    ])
    expect(answer).toEqual(expect.objectContaining({ status: true }))

    failSend(new Error('Resend down'))
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to send email verification'
      )
    )
  })
})

describe('without email (email.enabled: false)', () => {
  const noEmailApp = createTestApp({
    registration: { mode: 'closed' },
    email: { enabled: false },
  })

  afterAll(async () => {
    await noEmailApp.close()
  })

  async function resetTokens() {
    return testDb
      .select()
      .from(verification)
      .where(like(verification.identifier, 'reset-password:%'))
  }

  it('refuses a password reset and creates no token', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const tokensBefore = (await resetTokens()).length

    const res = await noEmailApp.inject({
      method: 'POST',
      url: '/api/auth/request-password-reset',
      payload: { email: 'test@test.com' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('RESET_PASSWORD_DISABLED')
    expect(await resetTokens()).toHaveLength(tokensBefore)
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('refuses better-auth’s own email change, reached over HTTP', async () => {
    const email = `no-email-${crypto.randomUUID()}@test.com`
    const signUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, name: 'No email', password: 'Password123!' },
    })

    const res = await noEmailApp.inject({
      method: 'POST',
      url: '/api/auth/change-email',
      payload: { newEmail: `moved-${email}` },
      headers: { cookie: cookieHeader(signUp.headers['set-cookie']) },
    })

    expect(res.statusCode).toBe(400)
    expect(
      await testDb.select().from(user).where(eq(user.email, email))
    ).toHaveLength(1)
    await testDb.delete(user).where(eq(user.email, email))
  })
})
