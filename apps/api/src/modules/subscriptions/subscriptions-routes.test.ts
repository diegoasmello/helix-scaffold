import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { subscriptions } from '@/db/schema'
import { user } from '@/db/schema'
import {
  cleanupAuth,
  cleanupSubscriptions,
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
  await cleanupSubscriptions()
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

it('returns 401 on any route when not authenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/subscriptions' })
  expect(res.statusCode).toBe(401)
})

describe('GET /subscription/status', () => {
  it('returns enabled status without authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/subscription/status',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('enabled')
    expect(typeof res.json().enabled).toBe('boolean')
  })
})

describe('GET /me/subscription', () => {
  it('returns 204 when user has no active subscription', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me/subscription',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 200 with active subscription when one exists', async () => {
    const [testUser] = await testDb.select().from(user).limit(1)
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    await testDb.insert(subscriptions).values({
      userId: testUser.id,
      planId: 'pro',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/me/subscription',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().planId).toBe('pro')
    expect(res.json().status).toBe('active')
  })

  it('returns 204 when user has only a canceled subscription', async () => {
    const [testUser] = await testDb.select().from(user).limit(1)
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    await testDb.insert(subscriptions).values({
      userId: testUser.id,
      planId: 'pro',
      status: 'canceled',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/me/subscription',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })
})

describe('Permission enforcement', () => {
  async function createRestrictedSession(
    grants: { resource: string; action: string }[]
  ) {
    const role = await createRoleWithPermissions(grants)
    const email = `restricted-subscriptions-${Date.now()}@test.com`
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

  it('returns 403 on GET /subscriptions without subscriptions:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/subscriptions',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on POST /subscriptions without subscriptions:create', async () => {
    const cookie = await createRestrictedSession([
      { resource: 'subscriptions', action: 'view' },
    ])
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)
    const [testUser] = await testDb.select().from(user).limit(1)

    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload: {
        userId: testUser.id,
        planId: 'pro',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: end.toISOString(),
      },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on PATCH /subscriptions/:id without subscriptions:edit', async () => {
    const [testUser] = await testDb.select().from(user).limit(1)
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)

    const [sub] = await testDb
      .insert(subscriptions)
      .values({
        userId: testUser.id,
        planId: 'pro',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: end,
      })
      .returning()

    const cookie = await createRestrictedSession([
      { resource: 'subscriptions', action: 'view' },
    ])
    const res = await app.inject({
      method: 'PATCH',
      url: `/subscriptions/${sub.id}`,
      payload: { planId: 'starter' },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on DELETE /subscriptions/:id without subscriptions:delete', async () => {
    const [testUser] = await testDb.select().from(user).limit(1)
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)

    const [sub] = await testDb
      .insert(subscriptions)
      .values({
        userId: testUser.id,
        planId: 'pro',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: end,
      })
      .returning()

    const cookie = await createRestrictedSession([
      { resource: 'subscriptions', action: 'view' },
    ])
    const res = await app.inject({
      method: 'DELETE',
      url: `/subscriptions/${sub.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /subscriptions', () => {
  it('returns empty paginated list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/subscriptions',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(0)
    expect(body.total).toBe(0)
    expect(body.page).toBe(1)
  })

  it('returns subscriptions with pagination', async () => {
    const [testUser] = await testDb.select().from(user).limit(1)
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)

    await testDb.insert(subscriptions).values([
      {
        userId: testUser.id,
        planId: 'pro',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: end,
      },
      {
        userId: testUser.id,
        planId: 'starter',
        status: 'trialing',
        currentPeriodStart: now,
        currentPeriodEnd: end,
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/subscriptions?page=1&pageSize=10',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(2)
    expect(res.json().total).toBe(2)
  })
})

describe('POST /subscriptions', () => {
  it('creates a subscription', async () => {
    const [testUser] = await testDb.select().from(user).limit(1)
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)

    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload: {
        userId: testUser.id,
        planId: 'pro',
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: end.toISOString(),
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().planId).toBe('pro')
    expect(res.json().status).toBe('active')
    expect(res.json().userId).toBe(testUser.id)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload: { planId: 'pro' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /subscriptions/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/subscriptions/nonexistent-id',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns the subscription when found', async () => {
    const [testUser] = await testDb.select().from(user).limit(1)
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)

    const [inserted] = await testDb
      .insert(subscriptions)
      .values({
        userId: testUser.id,
        planId: 'pro',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: end,
      })
      .returning()

    const res = await app.inject({
      method: 'GET',
      url: `/subscriptions/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(inserted.id)
    expect(res.json().planId).toBe('pro')
  })
})

describe('PATCH /subscriptions/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/subscriptions/nonexistent-id',
      payload: { planId: 'starter' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('updates and returns the subscription', async () => {
    const [testUser] = await testDb.select().from(user).limit(1)
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)

    const [inserted] = await testDb
      .insert(subscriptions)
      .values({
        userId: testUser.id,
        planId: 'pro',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: end,
      })
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/subscriptions/${inserted.id}`,
      payload: { planId: 'enterprise', status: 'canceled' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().planId).toBe('enterprise')
    expect(res.json().status).toBe('canceled')
    expect(res.json().userId).toBe(testUser.id)
  })
})

describe('DELETE /subscriptions/:id', () => {
  it('returns 204 for existing subscription', async () => {
    const [testUser] = await testDb.select().from(user).limit(1)
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + 1)

    const [inserted] = await testDb
      .insert(subscriptions)
      .values({
        userId: testUser.id,
        planId: 'pro',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: end,
      })
      .returning()

    const res = await app.inject({
      method: 'DELETE',
      url: `/subscriptions/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 204 for nonexistent subscription', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/subscriptions/nonexistent-id',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })
})
