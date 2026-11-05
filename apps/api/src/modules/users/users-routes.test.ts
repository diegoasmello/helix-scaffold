import { eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { user } from '@/db/schema/authentication'
import { rolePermissions } from '@/db/schema/role-permissions'
import { roles } from '@/db/schema/roles'
import {
  cleanupAuth,
  cleanupRoles,
  cleanupUsers,
  createAdminRole,
  createRoleWithPermissions,
  createSessionWithRole,
  createTestApp,
  createTestSession,
  findAuditLogs,
  getTestUser,
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
  const res = await app.inject({ method: 'GET', url: '/api/users' })
  expect(res.statusCode).toBe(401)
})

describe('GET /users', () => {
  it('returns paginated response with the authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
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
      url: '/api/users',
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
      url: '/api/users',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const alice = res
      .json()
      .data.find((u: { email: string }) => u.email === 'alice@test.com')
    expect(alice.role).toEqual({ id: role.id, name: 'editor', isAdmin: false })
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
      url: '/api/users?page=1&pageSize=2',
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
      url: '/api/users?sortBy=name&sortOrder=asc',
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
      url: '/api/users/nonexistent-id',
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
      url: `/api/users/${inserted.id}`,
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
      url: `/api/users/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.roleId).toBe(role.id)
    expect(body.role).toEqual({ id: role.id, name: 'admin', isAdmin: false })
  })
})

describe('POST /users', () => {
  it('creates a user and returns 201 with null role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
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
    // Logged without the password
    const [entry] = await findAuditLogs('create', 'users', body.id)
    expect(entry.metadata).toEqual({ name: 'Carol', email: 'carol@test.com' })
  })

  it('creates a user with roleId and returns embedded role', async () => {
    const [role] = await testDb
      .insert(roles)
      .values({ name: 'admin' })
      .returning()

    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
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
    expect(res.json().role).toEqual({
      id: role.id,
      name: 'admin',
      isAdmin: false,
    })
  })

  it('returns 404 when roleId does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        name: 'Eve',
        email: 'eve@test.com',
        password: 'Password123!',
        roleId: 'nonexistent',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({
      message: 'Role not found',
      code: 'role_not_found',
    })
  })

  it('returns 409 when email is already in use', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        name: 'First',
        email: 'duplicate@test.com',
        password: 'Password123!',
      },
      headers: { cookie: authCookie },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        name: 'Second',
        email: 'duplicate@test.com',
        password: 'Password123!',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({
      message: 'Email already in use',
      code: 'email_taken',
    })
  })

  it('returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: '', email: 'not-an-email', password: 'short' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when name exceeds max length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
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
  it('returns 409 email_taken when the email belongs to another user', async () => {
    const [first, second] = await testDb
      .insert(user)
      .values([
        { id: uuidv7(), name: 'A', email: 'a@test.com', emailVerified: false },
        { id: uuidv7(), name: 'B', email: 'b@test.com', emailVerified: false },
      ])
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${second.id}`,
      payload: { email: first.email },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({
      message: 'Email already in use',
      code: 'email_taken',
    })
  })

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/nonexistent-id',
      payload: { name: 'Updated' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({
      message: 'User not found',
      code: 'user_not_found',
    })
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
      url: `/api/users/${inserted.id}`,
      payload: { name: 'New Name' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('New Name')
    expect(body.email).toBe('update@test.com')
    expect(body.role).toBeNull()
    expect(await findAuditLogs('edit', 'users', inserted.id)).toHaveLength(1)
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
      url: `/api/users/${inserted.id}`,
      payload: { roleId: role.id },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().roleId).toBe(role.id)
    expect(res.json().role).toEqual({
      id: role.id,
      name: 'editor',
      isAdmin: false,
    })
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
      url: `/api/users/${inserted.id}`,
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
      url: `/api/users/${inserted.id}`,
      payload: { roleId: 'nonexistent' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({
      message: 'Role not found',
      code: 'role_not_found',
    })
  })
})

describe('GET /users/all', () => {
  it('returns all users as a plain array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/all',
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
      url: '/api/users/all',
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
      url: '/api/users/all',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const alice = res
      .json()
      .find((u: { email: string }) => u.email === 'alice@test.com')
    expect(alice.role).toEqual({ id: role.id, name: 'editor', isAdmin: false })
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
      url: `/api/users/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await findAuditLogs('delete', 'users', inserted.id)).toHaveLength(1)
  })

  it('returns 204 for non-existing user', async () => {
    const id = `missing-${crypto.randomUUID()}`
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${id}`,
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
      url: '/api/users/all',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on GET /users without users:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
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
      url: '/api/users',
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
      url: `/api/users/${inserted.id}`,
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
      url: `/api/users/${inserted.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('Privilege ceiling', () => {
  type Grant = { resource: string; action: string }

  const MANAGER: Grant[] = [
    { resource: 'users', action: 'view' },
    { resource: 'users', action: 'create' },
    { resource: 'users', action: 'edit' },
  ]

  async function roleWith(name: string, grants: Grant[]) {
    const [role] = await testDb.insert(roles).values({ name }).returning()
    if (grants.length > 0) {
      await testDb
        .insert(rolePermissions)
        .values(grants.map((grant) => ({ roleId: role.id, ...grant })))
    }
    return role
  }

  /** A signed-in user manager: `users:view/create/edit`, nothing else. */
  async function managerSession() {
    const role = await roleWith('Manager', MANAGER)
    const email = `manager-${uuidv7()}@test.com`
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, name: 'Manager', password: 'Password123!' },
    })
    const [manager] = await testDb
      .update(user)
      .set({ roleId: role.id })
      .where(eq(user.email, email))
      .returning()
    const setCookie = res.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
    return {
      cookie: cookies.map((c) => c.split(';')[0]).join('; '),
      manager,
      managerRoleId: role.id,
    }
  }

  async function userWith(roleId: string | null) {
    const [inserted] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Target',
        email: `target-${uuidv7()}@test.com`,
        emailVerified: false,
        roleId,
      })
      .returning()
    return inserted
  }

  it('refuses POST /users with a role beyond the caller and creates nothing', async () => {
    const { cookie } = await managerSession()
    const admin = await getTestUser()
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        name: 'Escalated',
        email: 'escalated@test.com',
        password: 'Password123!',
        roleId: admin.roleId,
      },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('role_not_assignable')
    const rows = await testDb
      .select()
      .from(user)
      .where(eq(user.email, 'escalated@test.com'))
    expect(rows).toHaveLength(0)
  })

  it('allows POST /users with a role within the caller', async () => {
    const { cookie } = await managerSession()
    const narrower = await roleWith('Viewer', [
      { resource: 'users', action: 'view' },
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        name: 'Viewer',
        email: 'viewer@test.com',
        password: 'Password123!',
        roleId: narrower.id,
      },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().role.id).toBe(narrower.id)
  })

  it('still answers 404 on POST /users for an unknown role', async () => {
    const { cookie } = await managerSession()
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        name: 'Nobody',
        email: 'nobody@test.com',
        password: 'Password123!',
        roleId: 'missing-role',
      },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe('role_not_found')
  })

  it('refuses giving yourself a broader role', async () => {
    const { cookie, manager, managerRoleId } = await managerSession()
    const admin = await getTestUser()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${manager.id}`,
      payload: { roleId: admin.roleId },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('role_not_assignable')
    const [row] = await testDb
      .select()
      .from(user)
      .where(eq(user.id, manager.id))
    expect(row.roleId).toBe(managerRoleId)
    expect(await findAuditLogs('edit', 'users', manager.id)).toHaveLength(0)
  })

  it("refuses rewriting a higher account's email", async () => {
    const { cookie } = await managerSession()
    const admin = await getTestUser()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${admin.id}`,
      payload: { email: 'attacker@evil.test' },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('user_not_editable')
    const [row] = await testDb.select().from(user).where(eq(user.id, admin.id))
    expect(row.email).toBe(admin.email)
  })

  it('refuses removing the role of a higher account', async () => {
    const { cookie } = await managerSession()
    const peer = await userWith(
      (await roleWith('Auditors', [{ resource: 'audit', action: 'view' }])).id
    )
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${peer.id}`,
      payload: { roleId: null },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('user_not_editable')
  })

  it('refuses changing the email of a user whose role grants more', async () => {
    const { cookie } = await managerSession()
    const peer = await userWith(
      (await roleWith('Auditors', [{ resource: 'audit', action: 'view' }])).id
    )
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${peer.id}`,
      payload: { email: 'new-address@test.com' },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('user_not_editable')
  })

  it('allows a name edit that re-sends the unchanged email and role, as the edit form does', async () => {
    const { cookie } = await managerSession()
    const peer = await userWith(
      (await roleWith('Auditors', [{ resource: 'audit', action: 'view' }])).id
    )
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${peer.id}`,
      payload: { name: 'Renamed', email: peer.email, roleId: peer.roleId },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Renamed')
  })

  it('allows assigning a role within the caller to a user without one', async () => {
    const { cookie } = await managerSession()
    const narrower = await roleWith('Viewer', [
      { resource: 'users', action: 'view' },
    ])
    const target = await userWith(null)
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${target.id}`,
      payload: { roleId: narrower.id },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().role.id).toBe(narrower.id)
  })
})

describe('Admin account', () => {
  // The test session holds every permission, like a moderator granted
  // everything: that alone must not reach the admin.
  async function adminUser() {
    const adminRole = await createAdminRole()
    const [admin] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Admin',
        email: `admin-${uuidv7()}@test.com`,
        emailVerified: false,
        roleId: adminRole.id,
      })
      .returning()
    return { admin, adminRole }
  }

  it('embeds isAdmin in the role', async () => {
    const { admin } = await adminUser()
    const res = await app.inject({
      method: 'GET',
      url: `/api/users/${admin.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.json().role.isAdmin).toBe(true)
  })

  it('refuses POST /users with the admin role and creates nothing', async () => {
    const { adminRole } = await adminUser()
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        name: 'Second admin',
        email: 'second-admin@test.com',
        password: 'Password123!',
        roleId: adminRole.id,
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('admin_role_not_assignable')
    const created = await testDb
      .select()
      .from(user)
      .where(eq(user.email, 'second-admin@test.com'))
    expect(created).toHaveLength(0)
  })

  it('refuses the admin role to the admin too', async () => {
    const { adminRole } = await adminUser()
    const cookie = await createSessionWithRole(app, adminRole.id)
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        name: 'Second admin',
        email: 'second-admin@test.com',
        password: 'Password123!',
        roleId: adminRole.id,
      },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('admin_role_not_assignable')
  })

  it('refuses PATCH /users/:id promoting a user to the admin role', async () => {
    const { adminRole } = await adminUser()
    const target = await getTestUser()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${target.id}`,
      payload: { roleId: adminRole.id },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('admin_role_not_assignable')
    const [unchanged] = await testDb
      .select()
      .from(user)
      .where(eq(user.id, target.id))
    expect(unchanged.roleId).toBe(target.roleId)
  })

  it('refuses any PATCH of an admin account, a name edit included', async () => {
    const { admin } = await adminUser()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${admin.id}`,
      payload: { name: 'Renamed', email: admin.email, roleId: admin.roleId },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('admin_user_locked')
    expect(await findAuditLogs('edit', 'users', admin.id)).toHaveLength(0)
  })

  it('refuses DELETE of an admin account and keeps it', async () => {
    const { admin } = await adminUser()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${admin.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('admin_user_locked')
    const kept = await testDb.select().from(user).where(eq(user.id, admin.id))
    expect(kept).toHaveLength(1)
    expect(await findAuditLogs('delete', 'users', admin.id)).toHaveLength(0)
  })

  it('refuses the admin deleting their own account here', async () => {
    const { admin, adminRole } = await adminUser()
    const cookie = await createSessionWithRole(app, adminRole.id)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${admin.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('admin_user_locked')
  })
})

describe('Privilege ceiling on DELETE /users/:id', () => {
  async function deleterSession() {
    const role = await createRoleWithPermissions([
      { resource: 'users', action: 'view' },
      { resource: 'users', action: 'delete' },
    ])
    return { cookie: await createSessionWithRole(app, role.id), role }
  }

  it('refuses deleting a user whose role grants more and keeps them', async () => {
    const { cookie } = await deleterSession()
    const target = await getTestUser()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${target.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('user_not_editable')
    const kept = await testDb.select().from(user).where(eq(user.id, target.id))
    expect(kept).toHaveLength(1)
  })

  it('allows deleting a user within the caller', async () => {
    const { cookie, role } = await deleterSession()
    const [target] = await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Peer',
        email: `peer-${uuidv7()}@test.com`,
        emailVerified: false,
        roleId: role.id,
      })
      .returning()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${target.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await findAuditLogs('delete', 'users', target.id)).toHaveLength(1)
  })
})
