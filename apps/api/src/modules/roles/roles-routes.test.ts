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
  const res = await app.inject({ method: 'GET', url: '/api/roles' })
  expect(res.statusCode).toBe(401)
})

// Filters out the internal test admin role that always exists in the test DB
function filterTestRole(roles: { name: string }[]) {
  return roles.filter((r) => r.name !== '__test_admin__')
}

describe('GET /roles', () => {
  it('returns empty paginated response when no application roles exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/roles',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(filterTestRole(body.data)).toEqual([])
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(10)
  })

  it('returns all roles in paginated response', async () => {
    await testDb.insert(roles).values([
      { name: 'admin', description: 'Administrator' },
      { name: 'viewer', description: 'Read-only user' },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/roles',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = filterTestRole(body.data)
    expect(data).toHaveLength(2)
    expect(body.total).toBeGreaterThanOrEqual(2)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(10)
  })

  it('applies page and pageSize correctly', async () => {
    await testDb
      .insert(roles)
      .values([{ name: 'role-a' }, { name: 'role-b' }, { name: 'role-c' }])

    const res = await app.inject({
      method: 'GET',
      url: '/api/roles?page=2&pageSize=2&sortBy=name&sortOrder=asc',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.page).toBe(2)
    expect(body.pageSize).toBe(2)
    // Page 2 with pageSize 2 and sortBy name asc: third item (role-c) plus possibly __test_admin__
    expect(body.data).toHaveLength(2)
  })

  it('sorts by name in descending order', async () => {
    await testDb
      .insert(roles)
      .values([{ name: 'alpha' }, { name: 'zeta' }, { name: 'beta' }])

    const res = await app.inject({
      method: 'GET',
      url: '/api/roles?sortBy=name&sortOrder=desc',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = filterTestRole(res.json().data)
    expect(body[0].name).toBe('zeta')
    expect(body[1].name).toBe('beta')
    expect(body[2].name).toBe('alpha')
  })
})

describe('GET /roles/all', () => {
  it('returns empty array when no application roles exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/roles/all',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(filterTestRole(res.json())).toEqual([])
  })

  it('returns all roles sorted by name', async () => {
    await testDb
      .insert(roles)
      .values([{ name: 'zeta' }, { name: 'alpha' }, { name: 'beta' }])

    const res = await app.inject({
      method: 'GET',
      url: '/api/roles/all',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = filterTestRole(res.json())
    expect(body).toHaveLength(3)
    expect(body[0].name).toBe('alpha')
    expect(body[1].name).toBe('beta')
    expect(body[2].name).toBe('zeta')
  })
})

describe('GET /roles/:id', () => {
  it('returns 404 when role not found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/roles/nonexistent-id',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Role not found' })
  })

  it('returns the role when found', async () => {
    const [inserted] = await testDb
      .insert(roles)
      .values({ name: 'editor', description: 'Can edit content' })
      .returning()

    const res = await app.inject({
      method: 'GET',
      url: `/api/roles/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(inserted.id)
    expect(body.name).toBe('editor')
    expect(body.description).toBe('Can edit content')
  })
})

describe('POST /roles', () => {
  it('creates a role and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/roles',
      payload: { name: 'moderator', description: 'Moderates content' },
      headers: { cookie: authCookie },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBeDefined()
    expect(body.name).toBe('moderator')
    expect(body.description).toBe('Moderates content')
    expect(await findAuditLogs('create', 'roles', body.id)).toHaveLength(1)
  })

  it('returns 400 when body is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/roles',
      payload: { name: '' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 name_taken for a duplicate name', async () => {
    await testDb.insert(roles).values({ name: 'moderator' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/roles',
      payload: { name: 'moderator' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({
      message: 'A role with this name already exists',
      code: 'name_taken',
    })
  })

  it('returns 400 when fields exceed max length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/roles',
      payload: { name: 'a'.repeat(101), description: 'b'.repeat(301) },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /roles/:id', () => {
  it('returns 404 when role not found', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/roles/nonexistent-id',
      payload: { name: 'updated' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Role not found' })
  })

  it('updates and returns the role', async () => {
    const [inserted] = await testDb
      .insert(roles)
      .values({ name: 'old-name', description: 'Old description' })
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/roles/${inserted.id}`,
      payload: { name: 'new-name' },
      headers: { cookie: authCookie },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.name).toBe('new-name')
    expect(body.description).toBe('Old description')
    expect(await findAuditLogs('edit', 'roles', inserted.id)).toHaveLength(1)
  })
  it('returns 409 name_taken when renaming to an existing name', async () => {
    await testDb.insert(roles).values({ name: 'taken' })
    const [inserted] = await testDb
      .insert(roles)
      .values({ name: 'free' })
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/roles/${inserted.id}`,
      payload: { name: 'taken' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('name_taken')
  })
})

describe('DELETE /roles/:id', () => {
  it('returns 204 on successful delete', async () => {
    const [inserted] = await testDb
      .insert(roles)
      .values({ name: 'to-delete' })
      .returning()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/roles/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await findAuditLogs('delete', 'roles', inserted.id)).toHaveLength(1)
  })

  it('returns 204 even when role does not exist', async () => {
    const id = `missing-${crypto.randomUUID()}`
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/roles/${id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    // Nothing was deleted, so nothing is audited
    expect(await findAuditLogs('delete', 'roles', id)).toHaveLength(0)
  })

  it('returns 409 when role has assigned users', async () => {
    const [inserted] = await testDb
      .insert(roles)
      .values({ name: 'role-with-users' })
      .returning()

    await testDb.insert(user).values({
      id: uuidv7(),
      name: 'User With Role',
      email: 'user-with-role@test.com',
      emailVerified: false,
      roleId: inserted.id,
    })

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/roles/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({
      message: 'Cannot delete a role that has assigned users',
      code: 'role_in_use',
    })
  })

  it('returns 409 default_role for the default registration role', async () => {
    const [inserted] = await testDb
      .insert(roles)
      .values({ name: 'default-role', isDefault: true })
      .returning()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/roles/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({
      message: 'Cannot delete the default registration role',
      code: 'default_role',
    })
    expect(await findAuditLogs('delete', 'roles', inserted.id)).toHaveLength(0)
  })
})

describe('Permission enforcement', () => {
  async function createRestrictedSession(
    grants: { resource: string; action: string }[]
  ) {
    const role = await createRoleWithPermissions(grants)
    const email = `restricted-roles-${Date.now()}@test.com`
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

  it('returns 403 on GET /roles without roles:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/roles',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on POST /roles without roles:create', async () => {
    const cookie = await createRestrictedSession([
      { resource: 'roles', action: 'view' },
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/api/roles',
      payload: { name: 'new-role' },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on PATCH /roles/:id without roles:edit', async () => {
    const [role] = await testDb
      .insert(roles)
      .values({ name: 'edit-target' })
      .returning()
    const cookie = await createRestrictedSession([
      { resource: 'roles', action: 'view' },
    ])
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/roles/${role.id}`,
      payload: { name: 'updated' },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on DELETE /roles/:id without roles:delete', async () => {
    const [role] = await testDb
      .insert(roles)
      .values({ name: 'delete-target' })
      .returning()
    const cookie = await createRestrictedSession([
      { resource: 'roles', action: 'view' },
    ])
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/roles/${role.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
