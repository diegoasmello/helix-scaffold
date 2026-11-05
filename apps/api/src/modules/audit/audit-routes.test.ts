import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { auditLogs } from '@/db/schema/audit-logs'
import { user } from '@/db/schema/authentication'
import {
  cleanupAuditLogs,
  cleanupAuth,
  cleanupRoles,
  cleanupUsers,
  createRoleWithPermissions,
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

beforeEach(async () => {
  await cleanupAuditLogs()
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

it('returns 401 on any route when not authenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/audit-logs' })
  expect(res.statusCode).toBe(401)
})

describe('GET /audit-logs', () => {
  it('returns empty paginated response when no logs exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  })

  it('returns logs ordered by createdAt ascending by default', async () => {
    await testDb.insert(auditLogs).values([
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'create',
        resource: 'users',
        resourceId: 't1',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'delete',
        resource: 'users',
        resourceId: 't2',
        createdAt: new Date('2026-01-01T12:00:00Z'),
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.data[0].action).toBe('create')
    expect(body.data[1].action).toBe('delete')
  })

  it('sorts by createdAt descending when sortOrder=desc', async () => {
    await testDb.insert(auditLogs).values([
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'create',
        resource: 'users',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'delete',
        resource: 'users',
        createdAt: new Date('2026-01-01T12:00:00Z'),
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs?sortBy=createdAt&sortOrder=desc',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data[0].action).toBe('delete')
    expect(body.data[1].action).toBe('create')
  })

  it('applies page and pageSize correctly', async () => {
    await testDb.insert(auditLogs).values([
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'create',
        resource: 'users',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'edit',
        resource: 'users',
        createdAt: new Date('2026-01-01T11:00:00Z'),
      },
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'delete',
        resource: 'users',
        createdAt: new Date('2026-01-01T12:00:00Z'),
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs?page=1&pageSize=2',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(3)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(2)
    expect(body.totalPages).toBe(2)
  })

  it('returns correct slice for page 2', async () => {
    await testDb.insert(auditLogs).values([
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'create',
        resource: 'users',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'edit',
        resource: 'users',
        createdAt: new Date('2026-01-01T11:00:00Z'),
      },
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'delete',
        resource: 'users',
        createdAt: new Date('2026-01-01T12:00:00Z'),
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs?page=2&pageSize=2',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.page).toBe(2)
    expect(body.data[0].action).toBe('delete')
  })

  it('sorts by userName ascending', async () => {
    await testDb.insert(auditLogs).values([
      {
        userId: 'u1',
        userName: 'Charlie',
        userEmail: 'charlie@example.com',
        action: 'create',
        resource: 'users',
      },
      {
        userId: 'u2',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'edit',
        resource: 'users',
      },
      {
        userId: 'u3',
        userName: 'Bob',
        userEmail: 'bob@example.com',
        action: 'delete',
        resource: 'users',
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs?sortBy=userName&sortOrder=asc',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data[0].userName).toBe('Alice')
    expect(body.data[1].userName).toBe('Bob')
    expect(body.data[2].userName).toBe('Charlie')
  })

  it('sorts by resource descending', async () => {
    await testDb.insert(auditLogs).values([
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'create',
        resource: 'roles',
      },
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'edit',
        resource: 'users',
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs?sortBy=resource&sortOrder=desc',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data[0].resource).toBe('users')
    expect(body.data[1].resource).toBe('roles')
  })
})

describe('GET /audit-logs/:id', () => {
  it('returns 404 when log not found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs/nonexistent-id',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Audit log not found' })
  })

  it('returns the log entry with all fields', async () => {
    const [inserted] = await testDb
      .insert(auditLogs)
      .values({
        userId: 'u1',
        userName: 'Bob',
        userEmail: 'bob@example.com',
        action: 'edit',
        resource: 'roles',
        resourceId: 'r1',
        metadata: { name: 'Updated Name' },
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      })
      .returning()

    const res = await app.inject({
      method: 'GET',
      url: `/api/audit-logs/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(inserted.id)
    expect(body.userName).toBe('Bob')
    expect(body.action).toBe('edit')
    expect(body.resource).toBe('roles')
    expect(body.resourceId).toBe('r1')
    expect(body.metadata).toEqual({ name: 'Updated Name' })
    expect(body.ip).toBe('192.168.1.1')
    expect(body.userAgent).toBe('Mozilla/5.0')
  })
})

describe('GET /audit-logs/export', () => {
  it('returns 200 with a PDF buffer when no logs exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs/export',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="audit-logs-\d{4}-\d{2}-\d{2}\.pdf"$/
    )
    expect(res.rawPayload.length).toBeGreaterThan(0)
  })

  it('returns a PDF with seeded logs respecting sortOrder', async () => {
    await testDb.insert(auditLogs).values([
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'create',
        resource: 'users',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        userId: 'u2',
        userName: 'Bob',
        userEmail: 'bob@example.com',
        action: 'delete',
        resource: 'roles',
        createdAt: new Date('2026-01-01T12:00:00Z'),
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs/export?sortBy=createdAt&sortOrder=desc',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
  })
})

describe('Permission enforcement', () => {
  async function createRestrictedSession(
    grants: { resource: string; action: string }[]
  ) {
    const role = await createRoleWithPermissions(grants)
    const email = `restricted-audit-${Date.now()}@test.com`
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

  beforeEach(async () => {
    await cleanupUsers()
    await cleanupRoles()
  })

  it('returns 403 on GET /audit-logs without audit:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on GET /audit-logs/:id without audit:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs/some-id',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on GET /audit-logs/export without audit:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit-logs/export',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
