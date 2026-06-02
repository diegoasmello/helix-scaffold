import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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

it('returns 401 on GET /me when not authenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/me' })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on GET /me/providers when not authenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/me/providers' })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on PATCH /me when not authenticated', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/me',
    payload: { name: 'New Name' },
  })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on PATCH /me/email when not authenticated', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/me/email',
    payload: { newEmail: 'new@test.com' },
  })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on PATCH /me/password when not authenticated', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/me/password',
    payload: { currentPassword: 'Password123!', newPassword: 'NewPass456!' },
  })
  expect(res.statusCode).toBe(401)
})

it('returns 401 on POST /me/set-password when not authenticated', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/me/set-password',
    payload: { newPassword: 'NewPassword123!' },
  })
  expect(res.statusCode).toBe(401)
})

describe('GET /me/providers', () => {
  it('returns 200 with a providers array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me/providers',
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
      url: '/me',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.email).toBe('test@test.com')
    expect(body.name).toBe('Test User')
    expect(body.password).toBeUndefined()
  })
})

describe('PATCH /me', () => {
  it('updates the user name', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      payload: { name: 'Updated Name' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Updated Name')

    await app.inject({
      method: 'PATCH',
      url: '/me',
      payload: { name: 'Test User' },
      headers: { cookie: authCookie },
    })
  })

  it('returns 400 for invalid body (empty name)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
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
      url: '/me/email',
      payload: { newEmail: 'newemail@test.com' },
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
      url: '/me/email',
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
      url: '/me/email',
      payload: { newEmail: existingEmail },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('This email is already in use')

    await testDb
      .delete(user)
      .where((await import('drizzle-orm')).eq(user.email, existingEmail))
  })
})

describe('POST /me/set-password', () => {
  // The 204 success case requires a user without a credential account (social-only).
  // The test admin is created via email/password so auth.api.setPassword rejects them.
  // The happy path is covered by E2E tests with a real social login flow.

  it('returns 400 for an authenticated user who already has a password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/me/set-password',
      payload: { newPassword: 'BrandNew123!' },
      headers: { cookie: authCookie },
    })
    // better-auth rejects setPassword when the user already has a credential account
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for short password (Zod validation)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/me/set-password',
      payload: { newPassword: 'short' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /me/password', () => {
  it('changes the password successfully', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      payload: {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword456!',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)

    await app.inject({
      method: 'PATCH',
      url: '/me/password',
      payload: {
        currentPassword: 'NewPassword456!',
        newPassword: 'Password123!',
      },
      headers: { cookie: authCookie },
    })
  })

  it('returns 400 when current password is wrong', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      payload: {
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPassword456!',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Current password is incorrect')
  })

  it('returns 400 for invalid body (short password)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      payload: {
        currentPassword: 'Password123!',
        newPassword: 'short',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})
