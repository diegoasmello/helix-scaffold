import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ALL_PERMISSIONS } from '@/config/permissions'
import { user } from '@/db/schema/authentication'
import { rolePermissions } from '@/db/schema/role-permissions'
import { roles } from '@/db/schema/roles'
import { cleanupAuth, createTestApp, testDb } from '@/test/helpers'

const app = createTestApp()

beforeEach(async () => {
  await cleanupAuth()
  await testDb.delete(rolePermissions)
  await testDb.delete(roles)
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

describe('GET /bootstrap/status', () => {
  it('returns bootstrapped false when no users exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/bootstrap/status' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ bootstrapped: false })
  })

  it('returns bootstrapped true when users exist', async () => {
    await app.inject({
      method: 'POST',
      url: '/bootstrap',
      payload: {
        name: 'Admin',
        email: 'admin@test.com',
        password: 'Password123!',
      },
      headers: { 'content-type': 'application/json' },
    })

    const res = await app.inject({ method: 'GET', url: '/bootstrap/status' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ bootstrapped: true })
  })
})

describe('POST /bootstrap', () => {
  it('creates admin user and role with all permissions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/bootstrap',
      payload: {
        name: 'Admin',
        email: 'admin@test.com',
        password: 'Password123!',
      },
      headers: { 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().message).toBe('System bootstrapped successfully')

    const users = await testDb.select().from(user)
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('admin@test.com')
    expect(users[0].roleId).not.toBeNull()

    const allRoles = await testDb.select().from(roles)
    expect(allRoles).toHaveLength(1)
    expect(allRoles[0].name).toBe('Admin')

    const perms = await testDb.select().from(rolePermissions)
    expect(perms).toHaveLength(ALL_PERMISSIONS.length)
  })

  it('returns 409 when system is already bootstrapped', async () => {
    await app.inject({
      method: 'POST',
      url: '/bootstrap',
      payload: {
        name: 'Admin',
        email: 'admin@test.com',
        password: 'Password123!',
      },
      headers: { 'content-type': 'application/json' },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/bootstrap',
      payload: {
        name: 'Second',
        email: 'second@test.com',
        password: 'Password123!',
      },
      headers: { 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ message: 'System already bootstrapped' })
  })

  it('returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/bootstrap',
      payload: { name: '', email: 'not-an-email', password: 'short' },
      headers: { 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(400)
  })
})
