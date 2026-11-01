import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '@/app'
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
    const adminRole = allRoles.find((r) => r.name === 'Admin')
    expect(adminRole).toBeDefined()
    expect(adminRole?.isDefault).toBe(false)

    // In open registration mode, bootstrap also creates a default User role
    const userRole = allRoles.find((r) => r.name === 'User')
    expect(userRole).toBeDefined()
    expect(userRole?.isDefault).toBe(true)

    const adminPerms = await testDb
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, adminRole!.id))
    expect(adminPerms).toHaveLength(ALL_PERMISSIONS.length)

    // The default role starts empty — the product decides what users may do
    const userPerms = await testDb
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, userRole!.id))
    expect(userPerms).toHaveLength(0)
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

  it('leaves no user behind when setting up the roles fails', async () => {
    // Same database, but every transaction fails — after better-auth has
    // already created the user outside it
    const failingDb = Object.create(testDb, {
      transaction: { value: () => Promise.reject(new Error('boom')) },
    }) as typeof testDb
    const failingApp = buildApp(failingDb)

    const res = await failingApp.inject({
      method: 'POST',
      url: '/bootstrap',
      payload: {
        name: 'Admin',
        email: 'admin@test.com',
        password: 'Password123!',
      },
      headers: { 'content-type': 'application/json' },
    })
    await failingApp.close()
    expect(res.statusCode).toBe(500)

    expect(await testDb.select().from(user)).toHaveLength(0)
    const status = await app.inject({ method: 'GET', url: '/bootstrap/status' })
    expect(status.json()).toEqual({ bootstrapped: false })
  })

  it('reuses leftover Admin and User roles', async () => {
    // Users deleted by hand, roles left behind: an Admin role that is the
    // default and has a single permission, and a non-default User role
    const [leftoverAdmin] = await testDb
      .insert(roles)
      .values({ name: 'Admin', isDefault: true })
      .returning()
    await testDb
      .insert(rolePermissions)
      .values({ roleId: leftoverAdmin.id, resource: 'todos', action: 'view' })
    const [leftoverUser] = await testDb
      .insert(roles)
      .values({ name: 'User' })
      .returning()

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

    const [admin] = await testDb.select().from(user)
    expect(admin.roleId).toBe(leftoverAdmin.id)
    const [adminRole] = await testDb
      .select()
      .from(roles)
      .where(eq(roles.id, leftoverAdmin.id))
    expect(adminRole.isDefault).toBe(false)
    expect(
      await testDb
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, leftoverAdmin.id))
    ).toHaveLength(ALL_PERMISSIONS.length)

    const [userRole] = await testDb
      .select()
      .from(roles)
      .where(eq(roles.id, leftoverUser.id))
    expect(userRole.isDefault).toBe(true)
    expect(await testDb.select().from(roles)).toHaveLength(2)
  })

  it('keeps a leftover default role with its permissions', async () => {
    const [members] = await testDb
      .insert(roles)
      .values({ name: 'Members', isDefault: true })
      .returning()
    await testDb
      .insert(rolePermissions)
      .values({ roleId: members.id, resource: 'todos', action: 'view' })

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

    const allRoles = await testDb.select().from(roles)
    expect(allRoles.map((r) => r.name).sort()).toEqual(['Admin', 'Members'])
    expect(allRoles.find((r) => r.isDefault)?.id).toBe(members.id)
    expect(
      await testDb
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, members.id))
    ).toHaveLength(1)
  })

  it('creates a single admin when two bootstraps race', async () => {
    const bootstrap = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/bootstrap',
        payload: { name: 'Admin', email, password: 'Password123!' },
        headers: { 'content-type': 'application/json' },
      })

    const results = await Promise.all([
      bootstrap('first@test.com'),
      bootstrap('second@test.com'),
    ])

    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409])
    expect(await testDb.select().from(user)).toHaveLength(1)
    expect(
      await testDb.select().from(roles).where(eq(roles.name, 'Admin'))
    ).toHaveLength(1)
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

// A public route that creates an admin must never come back: the only way to
// create the first admin is POST /bootstrap, which refuses once a user exists.
it('exposes no other route that can create an admin', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/bootstrap/e2e-user',
    payload: { name: 'X', email: 'x@test.com', password: 'Password123!' },
    headers: { 'content-type': 'application/json' },
  })
  expect(res.statusCode).toBe(404)
})
