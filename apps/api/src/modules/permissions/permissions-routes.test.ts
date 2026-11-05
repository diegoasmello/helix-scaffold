import { eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ALL_PERMISSIONS } from '@/config/permissions'
import { auditLogs } from '@/db/schema'
import { user } from '@/db/schema/authentication'
import {
  cleanupAuditLogs,
  cleanupAuth,
  cleanupRoles,
  cleanupUsers,
  createAdminRole,
  createRoleWithPermissions,
  createSessionWithRole,
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
  await cleanupAuditLogs()
  await cleanupUsers()
  await cleanupRoles()
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

it('returns 401 on any route when not authenticated', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/permissions/resources',
  })
  expect(res.statusCode).toBe(401)
})

describe('GET /permissions/resources', () => {
  it('returns the catalog of resources and actions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/permissions/resources',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('resource')
    expect(body[0]).toHaveProperty('label')
    expect(body[0]).toHaveProperty('actions')
    expect(body[0]).toHaveProperty('requires')
  })

  it("lists each action's requirements", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/permissions/resources',
      headers: { cookie: authCookie },
    })
    const permissions = res
      .json()
      .find((def: { resource: string }) => def.resource === 'permissions')
    expect(permissions.requires).toEqual({
      view: [{ resource: 'roles', action: 'view' }],
      edit: [{ resource: 'permissions', action: 'view' }],
    })
  })
})

describe('GET /me/permissions', () => {
  it('returns grants for the authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/permissions',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('grants')
    expect(typeof body.grants).toBe('object')
  })

  it('returns empty grants when user has no role', async () => {
    const email = `norole-${Date.now()}@test.com`
    const signUpRes = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: JSON.stringify({
        email,
        name: 'No Role',
        password: 'Password123!',
      }),
      headers: { 'content-type': 'application/json' },
    })
    // user created via sign-up has no roleId assigned
    const setCookie = signUpRes.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
    const noRoleCookie = cookies.map((c) => c.split(';')[0]).join('; ')

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/permissions',
      headers: { cookie: noRoleCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ grants: {} })
  })
})

describe('GET /roles/:id/permissions', () => {
  it('returns 403 when user lacks permissions:view', async () => {
    const restrictedRole = await createRoleWithPermissions([])
    const email = `restricted-perms-${Date.now()}@test.com`
    const signUpRes = await app.inject({
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
      .set({ roleId: restrictedRole.id })
      .where(eq(user.email, email))
    const setCookie = signUpRes.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
    const restrictedCookie = cookies.map((c) => c.split(';')[0]).join('; ')

    const targetRole = await createRoleWithPermissions([])
    const res = await app.inject({
      method: 'GET',
      url: `/api/roles/${targetRole.id}/permissions`,
      headers: { cookie: restrictedCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns grants for a role', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'users', action: 'view' },
      { resource: 'users', action: 'create' },
    ])

    const res = await app.inject({
      method: 'GET',
      url: `/api/roles/${role.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.grants.users).toEqual(
      expect.arrayContaining(['view', 'create'])
    )
  })

  it('returns empty grants for role with no permissions', async () => {
    const role = await createRoleWithPermissions([])
    const res = await app.inject({
      method: 'GET',
      url: `/api/roles/${role.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().grants).toEqual({})
  })
})

describe('PUT /roles/:id/permissions', () => {
  it('replaces permissions for a role', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'users', action: 'view' },
    ])

    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: {
        grants: {
          users: ['view', 'create', 'edit'],
          roles: ['view'],
        },
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.grants.users).toEqual(
      expect.arrayContaining(['view', 'create', 'edit'])
    )
    expect(body.grants.roles).toEqual(['view'])
  })

  it('removes all permissions when grants is empty', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'users', action: 'view' },
    ])

    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: {} },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().grants).toEqual({})
  })

  it('returns 400 for a resource not in RESOURCE_DEFINITIONS', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'users', action: 'view' },
    ])

    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: { users: ['view'], unknown: ['view'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('unknown:view')

    // Rejected as a whole: the existing grants are untouched
    const after = await app.inject({
      method: 'GET',
      url: `/api/roles/${role.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(after.json().grants).toEqual({ users: ['view'] })
  })

  it('returns 400 for an action the resource does not declare', async () => {
    const role = await createRoleWithPermissions([])

    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: { audit: ['view', 'delete'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('audit:delete')
  })

  it('returns 400 when a grant comes without its requirements', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'roles', action: 'view' },
    ])

    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: { permissions: ['edit'], users: ['edit'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('missing_required_permissions')
    expect(res.json().message).toContain('permissions:view')
    expect(res.json().message).toContain('users:view')
    expect(res.json().message).toContain('roles:view')

    const after = await app.inject({
      method: 'GET',
      url: `/api/roles/${role.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(after.json().grants).toEqual({ roles: ['view'] })
  })

  it('accepts grants that bring their requirements', async () => {
    const role = await createRoleWithPermissions([])

    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: {
        grants: { roles: ['view'], permissions: ['view', 'edit'] },
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 404 when the role does not exist', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${uuidv7()}/permissions`,
      payload: { grants: { users: ['view'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({
      message: 'Role not found',
      code: 'role_not_found',
    })
  })

  it('ignores duplicate actions instead of failing', async () => {
    const role = await createRoleWithPermissions([])

    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: { users: ['view', 'view'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().grants).toEqual({ users: ['view'] })
  })

  it('writes an audit log entry with the new grants', async () => {
    const role = await createRoleWithPermissions([])
    const grants = { users: ['view'], roles: ['view', 'edit'] }

    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)

    const [entry] = await testDb
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, role.id))
    expect(entry).toMatchObject({
      action: 'edit',
      resource: 'permissions',
      metadata: { grants },
    })
  })

  it('returns 403 when user lacks permissions:edit', async () => {
    const restrictedRole = await createRoleWithPermissions([
      { resource: 'users', action: 'view' },
    ])

    await testDb
      .insert(user)
      .values({
        id: uuidv7(),
        name: 'Restricted',
        email: 'restricted@test.com',
        emailVerified: false,
        roleId: restrictedRole.id,
      })
      .returning()

    const signUpRes = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: JSON.stringify({
        email: 'restricted2@test.com',
        name: 'Restricted2',
        password: 'Password123!',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const restrictedRole2 = await createRoleWithPermissions([])
    await testDb
      .update(user)
      .set({ roleId: restrictedRole2.id })
      .where(eq(user.email, 'restricted2@test.com'))

    const setCookie = signUpRes.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
    const restrictedCookie = cookies.map((c) => c.split(';')[0]).join('; ')

    const targetRole = await createRoleWithPermissions([])
    const res = await app.inject({
      method: 'PUT',
      url: `/api/roles/${targetRole.id}/permissions`,
      payload: { grants: { users: ['view'] } },
      headers: { cookie: restrictedCookie },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('Privilege ceiling', () => {
  // A delegated moderator: sees and edits roles and their permissions,
  // nothing else (no roles:delete, no users:*).
  const MODERATOR = [
    { resource: 'roles', action: 'view' },
    { resource: 'roles', action: 'edit' },
    { resource: 'permissions', action: 'view' },
    { resource: 'permissions', action: 'edit' },
  ]

  async function moderator() {
    const role = await createRoleWithPermissions(MODERATOR)
    return { cookie: await createSessionWithRole(app, role.id), role }
  }

  function put(cookie: string, roleId: string, grants: object) {
    return app.inject({
      method: 'PUT',
      url: `/api/roles/${roleId}/permissions`,
      payload: { grants },
      headers: { cookie },
    })
  }

  it('lets a moderator grant a lower role what the moderator holds', async () => {
    const { cookie } = await moderator()
    const member = await createRoleWithPermissions([])
    const res = await put(cookie, member.id, { roles: ['view', 'edit'] })
    expect(res.statusCode).toBe(200)
    expect(res.json().grants.roles.sort()).toEqual(['edit', 'view'])
  })

  it('refuses a permission the moderator lacks, and changes nothing', async () => {
    const { cookie } = await moderator()
    const member = await createRoleWithPermissions([
      { resource: 'roles', action: 'view' },
    ])
    const res = await put(cookie, member.id, {
      roles: ['view', 'delete'],
      users: ['create'],
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('permissions_not_grantable')
    expect(res.json().message).toContain('roles:delete')
    expect(res.json().message).toContain('users:create')

    const after = await app.inject({
      method: 'GET',
      url: `/api/roles/${member.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(after.json().grants).toEqual({ roles: ['view'] })
  })

  it("refuses to touch a role above the moderator's, even to remove", async () => {
    const { cookie } = await moderator()
    const admin = await createRoleWithPermissions([
      ...MODERATOR,
      { resource: 'users', action: 'create' },
    ])
    const res = await put(cookie, admin.id, {})
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('role_not_editable')
  })

  it('stops a moderator from raising their own role', async () => {
    const { cookie, role } = await moderator()
    const res = await put(cookie, role.id, {
      roles: ['view', 'edit', 'delete'],
      permissions: ['view', 'edit'],
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('permissions_not_grantable')
  })

  it('writes no audit entry for a refused change', async () => {
    const { cookie } = await moderator()
    const member = await createRoleWithPermissions([])
    await put(cookie, member.id, { users: ['create'] })
    const entries = await testDb
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, member.id))
    expect(entries).toHaveLength(0)
  })
})

describe('Admin role', () => {
  function pairs(grants: Record<string, string[]>) {
    return Object.entries(grants).flatMap(([resource, actions]) =>
      actions.map((action) => `${resource}:${action}`)
    )
  }
  const catalog = ALL_PERMISSIONS.map((p) => `${p.resource}:${p.action}`)

  it('holds the whole catalog with no permission rows', async () => {
    const adminRole = await createAdminRole()
    const res = await app.inject({
      method: 'GET',
      url: `/api/roles/${adminRole.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(pairs(res.json().grants).sort()).toEqual([...catalog].sort())
  })

  it('gives the admin every permission on GET /me/permissions', async () => {
    const adminRole = await createAdminRole()
    const cookie = await createSessionWithRole(app, adminRole.id)
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/permissions',
      headers: { cookie },
    })
    expect(pairs(res.json().grants).sort()).toEqual([...catalog].sort())
  })

  it('refuses PUT on the admin role to everyone, the admin included', async () => {
    const adminRole = await createAdminRole()
    const cookie = await createSessionWithRole(app, adminRole.id)
    for (const headers of [{ cookie: authCookie }, { cookie }]) {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/roles/${adminRole.id}/permissions`,
        payload: { grants: {} },
        headers,
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe('admin_role_locked')
    }
    const entries = await testDb
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, adminRole.id))
    expect(entries).toHaveLength(0)
  })
})

describe('Subscriptions turned off', () => {
  const disabledApp = createTestApp({ subscriptions: { enabled: false } })

  afterAll(async () => {
    await disabledApp.close()
  })

  it('leaves the subscriptions resource out of the catalog', async () => {
    const res = await disabledApp.inject({
      method: 'GET',
      url: '/api/permissions/resources',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const resources = res
      .json()
      .map((def: { resource: string }) => def.resource)
    expect(resources).not.toContain('subscriptions')
    expect(resources).toContain('audit')
  })

  it('shows a role without its subscription grants', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'audit', action: 'view' },
      { resource: 'subscriptions', action: 'view' },
    ])

    const res = await disabledApp.inject({
      method: 'GET',
      url: `/api/roles/${role.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().grants).toEqual({ audit: ['view'] })
  })

  it('refuses subscription grants, writing nothing', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'audit', action: 'view' },
    ])

    const res = await disabledApp.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: { audit: ['view'], subscriptions: ['view'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('unknown_permissions')
    expect(res.json().message).toContain('subscriptions:view')

    const after = await app.inject({
      method: 'GET',
      url: `/api/roles/${role.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(after.json().grants).toEqual({ audit: ['view'] })
  })

  it('keeps the subscription grants a role already holds', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'audit', action: 'view' },
      { resource: 'subscriptions', action: 'view' },
    ])

    const res = await disabledApp.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: { users: ['view'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().grants).toEqual({ users: ['view'] })

    // Back on, the role still has them.
    const after = await app.inject({
      method: 'GET',
      url: `/api/roles/${role.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(after.json().grants).toEqual({
      users: ['view'],
      subscriptions: ['view'],
    })
  })
  it('shows the admin role without the subscription grants', async () => {
    const adminRole = await createAdminRole()

    const res = await disabledApp.inject({
      method: 'GET',
      url: `/api/roles/${adminRole.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().grants).not.toHaveProperty('subscriptions')
    expect(res.json().grants.users).toEqual(
      expect.arrayContaining(['view', 'create', 'edit', 'delete'])
    )
  })

  it('still counts kept grants in the privilege ceiling', async () => {
    // The moderator holds every pair the editor shows for the target.
    const moderatorRole = await createRoleWithPermissions([
      { resource: 'roles', action: 'view' },
      { resource: 'permissions', action: 'view' },
      { resource: 'permissions', action: 'edit' },
      { resource: 'audit', action: 'view' },
    ])
    const cookie = await createSessionWithRole(disabledApp, moderatorRole.id)
    const target = await createRoleWithPermissions([
      { resource: 'audit', action: 'view' },
      { resource: 'subscriptions', action: 'view' },
    ])

    const shown = await disabledApp.inject({
      method: 'GET',
      url: `/api/roles/${target.id}/permissions`,
      headers: { cookie },
    })
    expect(shown.json().grants).toEqual({ audit: ['view'] })
    // The role itself tells the editor not to offer the change
    const role = await disabledApp.inject({
      method: 'GET',
      url: `/api/roles/${target.id}`,
      headers: { cookie },
    })
    expect(role.json().manageable).toBe(false)

    const res = await disabledApp.inject({
      method: 'PUT',
      url: `/api/roles/${target.id}/permissions`,
      payload: { grants: { audit: ['view'] } },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('role_not_editable')
  })

  it('audits the kept and the dropped grants', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'subscriptions', action: 'view' },
      { resource: 'subscriptions', action: 'create' },
    ])

    const res = await disabledApp.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: { audit: ['view'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)

    const [entry] = await findAuditLogs('edit', 'permissions', role.id)
    expect(entry.metadata).toEqual({
      grants: { audit: ['view'] },
      kept: { subscriptions: ['view'] },
      dropped: { subscriptions: ['create'] },
    })
  })

  it('drops a kept grant whose requirement the body leaves out', async () => {
    // subscriptions:create requires subscriptions:view and users:view.
    const role = await createRoleWithPermissions([
      { resource: 'users', action: 'view' },
      { resource: 'subscriptions', action: 'view' },
      { resource: 'subscriptions', action: 'create' },
    ])

    const res = await disabledApp.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: { audit: ['view'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)

    const after = await app.inject({
      method: 'GET',
      url: `/api/roles/${role.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(after.json().grants).toEqual({
      audit: ['view'],
      subscriptions: ['view'],
    })
  })

  it('keeps a kept grant whose requirement the body still brings', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'users', action: 'view' },
      { resource: 'subscriptions', action: 'view' },
      { resource: 'subscriptions', action: 'create' },
    ])

    const res = await disabledApp.inject({
      method: 'PUT',
      url: `/api/roles/${role.id}/permissions`,
      payload: { grants: { users: ['view'], audit: ['view'] } },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)

    const after = await app.inject({
      method: 'GET',
      url: `/api/roles/${role.id}/permissions`,
      headers: { cookie: authCookie },
    })
    expect(after.json().grants).toEqual({
      users: ['view'],
      audit: ['view'],
      subscriptions: expect.arrayContaining(['view', 'create']),
    })
  })
})

describe('Bootstrap status', () => {
  it('GET /bootstrap/status returns bootstrapped true when users exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/bootstrap/status',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().bootstrapped).toBe(true)
  })
})
