import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { user } from '@/db/schema/authentication'
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

it('returns 401 on PATCH /me when not authenticated', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/me',
    payload: { name: 'New Name' },
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

    // restore
    await app.inject({
      method: 'PATCH',
      url: '/me',
      payload: { name: 'Test User' },
      headers: { cookie: authCookie },
    })
  })

  it('updates the user email', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      payload: { email: 'updated@test.com' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().email).toBe('updated@test.com')

    // restore original email
    await app.inject({
      method: 'PATCH',
      url: '/me',
      payload: { email: 'test@test.com' },
      headers: { cookie: authCookie },
    })
  })

  it('returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      payload: { email: 'not-an-email' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 when email is already in use by another user', async () => {
    const otherEmail = `other-${Date.now()}@test.com`
    await testDb.insert(user).values({
      id: `test-other-${Date.now()}`,
      name: 'Other User',
      email: otherEmail,
      emailVerified: false,
    })

    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      payload: { email: otherEmail },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toBe('Email already in use')

    await testDb.delete(user).where(eq(user.email, otherEmail))
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

    // restore original password
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
