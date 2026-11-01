import { eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { user } from '@/db/schema/authentication'
import { roles } from '@/db/schema/roles'
import {
  cleanupAuth,
  cleanupRoles,
  cleanupUsers,
  createRoleWithPermissions,
  createTestApp,
  createTestSession,
  findAuditLogs,
  testDb,
} from '@/test/helpers'

const app = createTestApp()
let authCookie = ''

beforeAll(async () => {
  await cleanupAuth()
  authCookie = await createTestSession(app)
})

beforeEach(async () => {
  // users must be cleaned before roles due to FK constraint
  await cleanupUsers()
  await cleanupRoles()
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

it('returns 401 on any route when not authenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/users' })
  expect(res.statusCode).toBe(401)
})

describe('GET /users', () => {
  it('returns paginated response with the authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].email).toBe('test@test.com')
    expect(body.data[0].password).toBeUndefined()
    expect(body.data[0]).toHaveProperty('role')
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(10)
    expect(body.totalPages).toBe(1)
  })

  it('returns all users', async () => {
    await testDb.insert(user).values({
      id: uuidv7(),
      name: 'Alice',
      email: 'alice@test.com',
      emailVerified: false,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(2)
    expect(res.json().total).toBe(2)
  })

  it('embeds role when user has one', async () => {
    const [role] = await testDb
      .insert(roles)
      .values({ name: 'editor' })
      .returning()
    await testDb.insert(user).values({
      id: uuidv7(),
      name: 'Alice',
      email: 'alice@test.com',
      emailVerified: false,
      roleId: role.id,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const alice = res
      .json()
      .data.find((u: { email: string }) => u.email === 'alice@test.com')
    expect(alice.role).toEqual({ id: role.id, name: 'editor' })
  })

  it('applies page and pageSize correctly', async () => {
    await testDb.insert(user).values([
      {
        id: uuidv7(),
        name: 'Alice',
        email: 'alice@test.com',
        emailVerified: false,
      },
      {
        id: uuidv7(),
        name: 'Bob',
        email: 'bob@test.com',
        emailVerified: false,
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/users?page=1&pageSize=2',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(3)
    expect(body.totalPages).toBe(2)
  })

  it('sorts by name ascending', async () => {
    await testDb.insert(user).values([
      {
        id: uuidv7(),
        name: 'Zara',
        email: 'zara@test.com',
        emailVerified: false,
      },
      {
        id: uuidv7(),
        name: 'Aaron',
        email: 'aaron@test.com',
        emailVerified: false,
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/users?sortBy=name&sortOrder=asc',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const names = res.json().data.map((u: { name: string }) => u.name)
    expect(names).toEqual([...names].sort())
  })
})

describe('GET /users/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/nonexistent-id',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'User not found' })
  })

  it('returns the user with null role when no role assigned', async () => {
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Bob',
        email: 'bob@test.com',
        emailVerified: false,
      })
      .returning()

    const res = await app.inject({
      method: 'GET',
      url: `/users/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(inserted.id)
    expect(body.email).toBe('bob@test.com')
    expect(body.roleId).toBeNull()
    expect(body.role).toBeNull()
    expect(body.password).toBeUndefined()
  })

  it('returns the user with embedded role', async () => {
    const [role] = await testDb
      .insert(roles)
      .values({ name: 'admin' })
      .returning()
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Carol',
        email: 'carol@test.com',
        emailVerified: false,
        roleId: role.id,
      })
      .returning()

    const res = await app.inject({
      method: 'GET',
      url: `/users/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.roleId).toBe(role.id)
    expect(body.role).toEqual({ id: role.id, name: 'admin' })
  })
})

describe('POST /users', () => {
  it('creates a user and returns 201 with null role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Carol',
        email: 'carol@test.com',
        password: 'Password123!',
      },
      headers: { cookie: authCookie },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('Carol')
    expect(body.email).toBe('carol@test.com')
    expect(body.roleId).toBeNull()
    expect(body.role).toBeNull()
    expect(body.password).toBeUndefined()
  })

  it('creates a user with roleId and returns embedded role', async () => {
    const [role] = await testDb
      .insert(roles)
      .values({ name: 'admin' })
      .returning()

    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Dave',
        email: 'dave@test.com',
        password: 'Password123!',
        roleId: role.id,
      },
      headers: { cookie: authCookie },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().roleId).toBe(role.id)
    expect(res.json().role).toEqual({ id: role.id, name: 'admin' })
  })

  it('returns 404 when roleId does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Eve',
        email: 'eve@test.com',
        password: 'Password123!',
        roleId: 'nonexistent',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Role not found' })
  })

  it('returns 409 when email is already in use', async () => {
    await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'First',
        email: 'duplicate@test.com',
        password: 'Password123!',
      },
      headers: { cookie: authCookie },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Second',
        email: 'duplicate@test.com',
        password: 'Password123!',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ message: 'Email already in use' })
  })

  it('returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: '', email: 'not-an-email', password: 'short' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when name exceeds max length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'a'.repeat(101),
        email: 'toolong@test.com',
        password: 'Password123!',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /users/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/nonexistent-id',
      payload: { name: 'Updated' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'User not found' })
  })

  it('updates name and preserves other fields', async () => {
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Old Name',
        email: 'update@test.com',
        emailVerified: false,
      })
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${inserted.id}`,
      payload: { name: 'New Name' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('New Name')
    expect(body.email).toBe('update@test.com')
    expect(body.role).toBeNull()
  })

  it('assigns a role to a user and returns embedded role', async () => {
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'No Role',
        email: 'norole@test.com',
        emailVerified: false,
      })
      .returning()
    const [role] = await testDb
      .insert(roles)
      .values({ name: 'editor' })
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${inserted.id}`,
      payload: { roleId: role.id },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().roleId).toBe(role.id)
    expect(res.json().role).toEqual({ id: role.id, name: 'editor' })
  })

  it('removes the role from a user when roleId is null', async () => {
    const [role] = await testDb
      .insert(roles)
      .values({ name: 'removable' })
      .returning()
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Has Role',
        email: 'hasrole@test.com',
        emailVerified: false,
        roleId: role.id,
      })
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${inserted.id}`,
      payload: { roleId: null },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().roleId).toBeNull()
    expect(res.json().role).toBeNull()
  })

  it('returns 404 when roleId does not exist', async () => {
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'User',
        email: 'user@test.com',
        emailVerified: false,
      })
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${inserted.id}`,
      payload: { roleId: 'nonexistent' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Role not found' })
  })
})

describe('GET /users/all', () => {
  it('returns all users as a plain array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/all',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(1)
    expect(body[0]).toHaveProperty('role')
    expect(body[0].password).toBeUndefined()
  })

  it('returns users sorted by name ascending', async () => {
    await testDb.insert(user).values([
      {
        id: uuidv7(),
        name: 'Zara',
        email: 'zara@test.com',
        emailVerified: false,
      },
      {
        id: uuidv7(),
        name: 'Aaron',
        email: 'aaron@test.com',
        emailVerified: false,
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/users/all',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const names = res.json().map((u: { name: string }) => u.name)
    expect(names).toEqual([...names].sort())
  })

  it('embeds role when user has one', async () => {
    const [role] = await testDb
      .insert(roles)
      .values({ name: 'editor' })
      .returning()
    await testDb.insert(user).values({
      id: uuidv7(),
      name: 'Alice',
      email: 'alice@test.com',
      emailVerified: false,
      roleId: role.id,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/users/all',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const alice = res
      .json()
      .find((u: { email: string }) => u.email === 'alice@test.com')
    expect(alice.role).toEqual({ id: role.id, name: 'editor' })
  })
})

describe('DELETE /users/:id', () => {
  it('returns 204 for existing user', async () => {
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'To Delete',
        email: 'delete@test.com',
        emailVerified: false,
      })
      .returning()

    const res = await app.inject({
      method: 'DELETE',
      url: `/users/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await findAuditLogs('delete', 'users', inserted.id)).toHaveLength(1)
  })

  it('returns 204 for non-existing user', async () => {
    const id = `missing-${crypto.randomUUID()}`
    const res = await app.inject({
      method: 'DELETE',
      url: `/users/${id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    // Nothing was deleted, so nothing is audited
    expect(await findAuditLogs('delete', 'users', id)).toHaveLength(0)
  })
})

describe('Permission enforcement', () => {
  async function createRestrictedSession(
    grants: { resource: string; action: string }[]
  ) {
    const role = await createRoleWithPermissions(grants)
    const email = `restricted-users-${Date.now()}@test.com`
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: JSON.stringify({
        email,
        name: 'Restricted',
        password: 'Password123!',
      }),
      headers: { 'content-type': 'application/json' },
    })
    await testDb
      .update(user)
      .set({ roleId: role.id })
      .where(eq(user.email, email))
    const setCookie = res.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
    return cookies.map((c) => c.split(';')[0]).join('; ')
  }

  it('returns 403 on GET /users/all without users:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/users/all',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on GET /users without users:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on POST /users without users:create', async () => {
    const cookie = await createRestrictedSession([
      { resource: 'users', action: 'view' },
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'New', email: 'new@test.com', password: 'Password123!' },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on PATCH /users/:id without users:edit', async () => {
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Target',
        email: 'target@test.com',
        emailVerified: false,
      })
      .returning()
    const cookie = await createRestrictedSession([
      { resource: 'users', action: 'view' },
    ])
    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${inserted.id}`,
      payload: { name: 'Updated' },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on DELETE /users/:id without users:delete', async () => {
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Target',
        email: 'todelete@test.com',
        emailVerified: false,
      })
      .returning()
    const cookie = await createRestrictedSession([
      { resource: 'users', action: 'view' },
    ])
    const res = await app.inject({
      method: 'DELETE',
      url: `/users/${inserted.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
