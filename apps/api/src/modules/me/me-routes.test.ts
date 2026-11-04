import { eq, like } from 'drizzle-orm'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { account, user, verification } from '@/db/schema/authentication'
import {
  cleanupAuth,
  createTestApp,
  createTestSession,
  findAuditLogs,
  getTestUser,
  TEST_ROLE_NAME,
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

it('returns 401 on GET /me when not authenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/me' })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on GET /me/providers when not authenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/me/providers' })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on PATCH /me when not authenticated', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/api/me',
    payload: { name: 'New Name' },
  })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on PATCH /me/email when not authenticated', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/api/me/email',
    payload: { newEmail: 'new@test.com' },
  })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on PATCH /me/password when not authenticated', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/api/me/password',
    payload: { currentPassword: 'Password123!', newPassword: 'NewPass456!' },
  })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on POST /me/set-password when not authenticated', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/me/set-password',
    payload: { newPassword: 'NewPassword123!' },
  })
  expect(res.statusCode).toBe(401)
})

describe('GET /me/providers', () => {
  it('returns 200 with a providers array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/providers',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().providers).toBeInstanceOf(Array)
  })
})

describe('GET /me', () => {
  it('returns the authenticated user profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.email).toBe('test@test.com')
    expect(body.name).toBe('Test User')
    expect(body.password).toBeUndefined()
  })

  it("includes the user's role", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: authCookie },
    })
    const body = res.json()
    expect(body.role).toEqual({ id: body.roleId, name: TEST_ROLE_NAME })
  })
})

describe('PATCH /me', () => {
  it('updates the user name', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      payload: { name: 'Updated Name' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Updated Name')
    const entries = await findAuditLogs('edit', 'me', res.json().id)
    expect(entries.map((e) => e.metadata)).toContainEqual({
      name: 'Updated Name',
    })

    await app.inject({
      method: 'PATCH',
      url: '/api/me',
      payload: { name: 'Test User' },
      headers: { cookie: authCookie },
    })
  })

  it('returns 400 for invalid body (empty name)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      payload: { name: '' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /me/email', () => {
  it('initiates email change and returns a confirmation message', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/email',
      payload: {
        newEmail: 'newemail@test.com',
        currentPassword: 'Password123!',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().message).toBeTypeOf('string')

    // clean up any verification token created
    await testDb.delete(
      (await import('@/db/schema/authentication')).verification
    )
  })

  it('returns 400 for invalid email', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/email',
      payload: { newEmail: 'not-an-email' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when the email is already in use by another account', async () => {
    const { user } = await import('@/db/schema/authentication')
    const { uuidv7 } = await import('uuidv7')
    const existingEmail = 'already-taken@test.com'
    await testDb.insert(user).values({
      id: uuidv7(),
      name: 'Other User',
      email: existingEmail,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/email',
      payload: { newEmail: existingEmail, currentPassword: 'Password123!' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      message: 'This email is already in use',
      code: 'email_taken',
    })

    await testDb
      .delete(user)
      .where((await import('drizzle-orm')).eq(user.email, existingEmail))
  })
})

describe('Re-authentication', () => {
  /** A fresh signed-up user (password `Password123!`), so lockouts stay theirs. */
  async function signUp() {
    const email = `reauth-${crypto.randomUUID()}@test.com`
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, name: 'Reauth', password: 'Password123!' },
    })
    const setCookie = res.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
    const [row] = await testDb.select().from(user).where(eq(user.email, email))
    return {
      email,
      userId: row.id,
      cookie: cookies.map((c) => c.split(';')[0]).join('; '),
    }
  }

  function changeEmail(cookie: string, payload: object) {
    return app.inject({
      method: 'PATCH',
      url: '/api/me/email',
      payload,
      headers: { cookie },
    })
  }

  function changePassword(cookie: string, currentPassword: string) {
    return app.inject({
      method: 'PATCH',
      url: '/api/me/password',
      payload: { currentPassword, newPassword: 'NewPassword456!' },
      headers: { cookie },
    })
  }

  async function verificationTokens() {
    return testDb.select().from(verification)
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    await testDb.delete(verification)
    await testDb.delete(user).where(like(user.email, 'reauth-%'))
  })

  it('refuses an email change without the current password, and starts nothing', async () => {
    const { cookie } = await signUp()
    const res = await changeEmail(cookie, { newEmail: 'moved@test.com' })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('current_password_required')
    expect(await verificationTokens()).toHaveLength(0)
  })

  it('refuses an email change with a wrong password', async () => {
    const { cookie } = await signUp()
    const res = await changeEmail(cookie, {
      newEmail: 'moved@test.com',
      currentPassword: 'WrongPassword!',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_password')
    expect(await verificationTokens()).toHaveLength(0)
  })

  it('tells the current address about the request', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { cookie, email } = await signUp()
    const res = await changeEmail(cookie, {
      newEmail: 'moved@test.com',
      currentPassword: 'Password123!',
    })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `To: ${email} \\| Subject: Your email address is being changed[\\s\\S]*moved@test\\.com`
          )
        )
      )
    )
  })

  it('asks no password of an account without one (social sign-in only)', async () => {
    const { cookie, userId } = await signUp()
    await testDb.delete(account).where(eq(account.userId, userId))
    const res = await changeEmail(cookie, { newEmail: 'moved@test.com' })
    expect(res.statusCode).toBe(200)
  })

  it('locks out after 5 wrong passwords, across email and password changes', async () => {
    const { cookie } = await signUp()
    for (let i = 0; i < 3; i++) {
      expect((await changePassword(cookie, 'WrongPassword!')).json().code).toBe(
        'invalid_password'
      )
    }
    for (let i = 0; i < 2; i++) {
      const res = await changeEmail(cookie, {
        newEmail: 'moved@test.com',
        currentPassword: 'WrongPassword!',
      })
      expect(res.json().code).toBe('invalid_password')
    }

    // Even the right password is refused now
    const locked = await changePassword(cookie, 'Password123!')
    expect(locked.statusCode).toBe(429)
    expect(locked.json().code).toBe('too_many_attempts')
    const lockedEmail = await changeEmail(cookie, {
      newEmail: 'moved@test.com',
      currentPassword: 'Password123!',
    })
    expect(lockedEmail.statusCode).toBe(429)
  })

  it('clears the count after a right password', async () => {
    const { cookie } = await signUp()
    for (let i = 0; i < 4; i++) await changePassword(cookie, 'WrongPassword!')
    const ok = await changeEmail(cookie, {
      newEmail: 'moved@test.com',
      currentPassword: 'Password123!',
    })
    expect(ok.statusCode).toBe(200)
    for (let i = 0; i < 4; i++) await changePassword(cookie, 'WrongPassword!')
    expect((await changePassword(cookie, 'WrongPassword!')).statusCode).toBe(
      400
    )
  })
})

describe('POST /me/set-password', () => {
  // The 204 success case requires a user without a credential account (social-only).
  // The test admin is created via email/password so auth.api.setPassword rejects them.
  // The happy path is covered by E2E tests with a real social login flow.

  it('returns 400 for an authenticated user who already has a password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/set-password',
      payload: { newPassword: 'BrandNew123!' },
      headers: { cookie: authCookie },
    })
    // better-auth rejects setPassword when the user already has a credential account
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for short password (Zod validation)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/set-password',
      payload: { newPassword: 'short' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /me/password', () => {
  /** A Cookie header carrying the cookies a response set. */
  function cookieHeader(setCookie: string | string[] | undefined) {
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
    return cookies.map((c) => c.split(';')[0]).join('; ')
  }

  /**
   * Changes the test user's password. Every session is revoked, so
   * `authCookie` becomes the new session the response sets.
   */
  async function changePassword(currentPassword: string, newPassword: string) {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/password',
      payload: { currentPassword, newPassword },
      headers: { cookie: authCookie },
    })
    if (res.statusCode === 204) {
      authCookie = cookieHeader(res.headers['set-cookie'])
    }
    return res
  }

  it('changes the password successfully', async () => {
    const res = await changePassword('Password123!', 'NewPassword456!')
    expect(res.statusCode).toBe(204)
    // Records that it changed — never the passwords themselves
    const { id } = await getTestUser()
    const metadata = (await findAuditLogs('edit', 'me', id)).map(
      (e) => e.metadata
    )
    expect(metadata).toContainEqual({ passwordChanged: true })
    expect(JSON.stringify(metadata)).not.toContain('Password')

    await changePassword('NewPassword456!', 'Password123!')
  })

  it('signs out every other session and keeps this device signed in', async () => {
    // Another device — or an attacker holding a stolen session
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: 'test@test.com', password: 'Password123!' },
    })
    const otherCookie = cookieHeader(signIn.headers['set-cookie'])
    const previousCookie = authCookie

    const res = await changePassword('Password123!', 'NewPassword456!')
    expect(res.statusCode).toBe(204)

    const getMe = (cookie: string) =>
      app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })
    expect((await getMe(otherCookie)).statusCode).toBe(401)
    expect((await getMe(previousCookie)).statusCode).toBe(401)
    expect((await getMe(authCookie)).statusCode).toBe(200)

    await changePassword('NewPassword456!', 'Password123!')
  })

  it('returns 400 when current password is wrong', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/password',
      payload: {
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPassword456!',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      message: 'Current password is incorrect',
      code: 'invalid_password',
    })
  })

  it('returns 400 for invalid body (short password)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/password',
      payload: {
        currentPassword: 'Password123!',
        newPassword: 'short',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})
