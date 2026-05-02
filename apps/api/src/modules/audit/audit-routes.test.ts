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
  const res = await app.inject({ method: 'GET', url: '/audit-logs' })
  expect(res.statusCode).toBe(401)
})

describe('GET /audit-logs', () => {
  it('returns empty array when no logs exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/audit-logs',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns logs ordered by createdAt descending', async () => {
    await testDb.insert(auditLogs).values([
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'create',
        resource: 'todos',
        resourceId: 't1',
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        action: 'delete',
        resource: 'todos',
        resourceId: 't2',
        createdAt: new Date('2026-01-01T12:00:00Z'),
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/audit-logs',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body[0].action).toBe('delete')
    expect(body[1].action).toBe('create')
  })
})

describe('GET /audit-logs/:id', () => {
  it('returns 404 when log not found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/audit-logs/nonexistent-id',
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
      url: `/audit-logs/${inserted.id}`,
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

describe('Audit logging via onResponse hook', () => {
  it('creates an audit log entry when a todo is created', async () => {
    await app.inject({
      method: 'POST',
      url: '/todos',
      payload: {
        title: 'Audited Todo',
        description: 'Desc',
        content: 'Content',
        date: '2026-01-01',
      },
      headers: { cookie: authCookie },
    })

    const logs = await testDb.select().from(auditLogs)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('create')
    expect(logs[0].resource).toBe('todos')
    expect(logs[0].metadata).toMatchObject({ title: 'Audited Todo' })
  })

  it('does not create an audit log when the operation fails', async () => {
    await app.inject({
      method: 'POST',
      url: '/todos',
      payload: { title: '' },
      headers: { cookie: authCookie },
    })

    const logs = await testDb.select().from(auditLogs)
    expect(logs).toHaveLength(0)
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
      url: '/audit-logs',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on GET /audit-logs/:id without audit:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/audit-logs/some-id',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
