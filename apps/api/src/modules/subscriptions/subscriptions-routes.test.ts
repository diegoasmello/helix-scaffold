import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { config } from '@/config'
import { subscriptions } from '@/db/schema'
import { user } from '@/db/schema'
import { createRequireSubscription } from '@/hooks/require-subscription'
import {
  cleanupAuth,
  cleanupSubscriptions,
  createRoleWithPermissions,
  createTestApp,
  createTestSession,
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
  await cleanupSubscriptions()
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

async function createRestrictedSession(
  grants: { resource: string; action: string }[],
  options: {
    planId?: string
    status?: 'active' | 'past_due'
    pastDueSince?: Date
  } = {}
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
  if (options.planId) {
    const [created] = await testDb
      .select()
      .from(user)
      .where(eq(user.email, email))
    await testDb.insert(subscriptions).values({
      userId: created.id,
      planId: options.planId,
      status: options.status ?? 'active',
      pastDueSince: options.pastDueSince ?? null,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date('2099-01-01'),
    })
  }
  const setCookie = res.headers['set-cookie']
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

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

  it('returns the plan catalog from config when enabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/subscription/status',
    })
    expect(res.json()).toEqual({
      enabled: true,
      plans: config.subscriptions.plans,
      pastDueGraceDays: config.subscriptions.pastDueGraceDays,
    })
  })
})

describe('requireSubscription (via GET /todos)', () => {
  const todosViewer = [{ resource: 'todos', action: 'view' }]

  it('returns 403 when the user has no active subscription', async () => {
    const cookie = await createRestrictedSession(todosViewer)
    const res = await app.inject({
      method: 'GET',
      url: '/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('Active subscription required')
  })

  it("returns 403 when the user's plan lacks the feature", async () => {
    const cookie = await createRestrictedSession(todosViewer, {
      planId: 'starter',
    })
    const res = await app.inject({
      method: 'GET',
      url: '/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('Your plan does not include this feature')
  })

  it("allows access when the user's plan includes the feature", async () => {
    const cookie = await createRestrictedSession(todosViewer, {
      planId: 'pro',
    })
    const res = await app.inject({
      method: 'GET',
      url: '/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
  })

  it('allows a past_due subscription within the grace period', async () => {
    const cookie = await createRestrictedSession(todosViewer, {
      planId: 'pro',
      status: 'past_due',
      pastDueSince: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    })
    const res = await app.inject({
      method: 'GET',
      url: '/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 403 for a past_due subscription after the grace period', async () => {
    const cookie = await createRestrictedSession(todosViewer, {
      planId: 'pro',
      status: 'past_due',
      pastDueSince: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    })
    const res = await app.inject({
      method: 'GET',
      url: '/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('lets users with subscriptions:view through without a subscription', async () => {
    const cookie = await createRestrictedSession([
      ...todosViewer,
      { resource: 'subscriptions', action: 'view' },
    ])
    const res = await app.inject({
      method: 'GET',
      url: '/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
  })

  it('throws at registration for a feature no plan declares', () => {
    const requireSubscription = createRequireSubscription(testDb)
    expect(() => requireSubscription('nonexistent')).toThrow(
      /requireSubscription\('nonexistent'\)/
    )
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
    const testUser = await getTestUser()
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
    const testUser = await getTestUser()
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
    const testUser = await getTestUser()

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
    const testUser = await getTestUser()
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
    const testUser = await getTestUser()
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
    const testUser = await getTestUser()
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
        status: 'canceled',
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
    const testUser = await getTestUser()
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
  it('returns 400 when the user does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload: {
        userId: 'nonexistent-user',
        planId: 'pro',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date('2099-01-01').toISOString(),
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('User not found')
  })

  it('returns 409 when the user already has a live subscription', async () => {
    const testUser = await getTestUser()
    const payload = {
      userId: testUser.id,
      planId: 'pro',
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date('2099-01-01').toISOString(),
    }
    const first = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload,
      headers: { cookie: authCookie },
    })
    expect(first.statusCode).toBe(201)

    const second = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload: { ...payload, status: 'trialing' },
      headers: { cookie: authCookie },
    })
    expect(second.statusCode).toBe(409)
    expect(second.json()).toEqual({
      message: 'User already has an active or trialing subscription',
      code: 'live_subscription_exists',
    })
  })

  it('returns 409 when the externalId is already used', async () => {
    const testUser = await getTestUser()
    await testDb.insert(subscriptions).values({
      userId: testUser.id,
      planId: 'pro',
      status: 'canceled',
      externalId: 'sub_taken',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date('2099-01-01'),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload: {
        userId: testUser.id,
        planId: 'pro',
        status: 'canceled',
        externalId: 'sub_taken',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date('2099-01-01').toISOString(),
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('external_id_taken')
  })

  it('allows non-live subscriptions alongside a live one', async () => {
    const testUser = await getTestUser()
    await testDb.insert(subscriptions).values({
      userId: testUser.id,
      planId: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date('2099-01-01'),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload: {
        userId: testUser.id,
        planId: 'starter',
        status: 'canceled',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date('2099-01-01').toISOString(),
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(201)
  })

  it('returns 400 for a plan not in the catalog', async () => {
    const testUser = await getTestUser()
    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload: {
        userId: testUser.id,
        planId: 'unknown-plan',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date('2099-01-01').toISOString(),
      },
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
    const testUser = await getTestUser()
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
    const testUser = await getTestUser()
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

  it('returns 409 when reactivating while another subscription is live', async () => {
    const testUser = await getTestUser()
    const [canceled] = await testDb
      .insert(subscriptions)
      .values([
        {
          userId: testUser.id,
          planId: 'starter',
          status: 'canceled',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date('2099-01-01'),
        },
        {
          userId: testUser.id,
          planId: 'pro',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date('2099-01-01'),
        },
      ])
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/subscriptions/${canceled.id}`,
      payload: { status: 'active' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('live_subscription_exists')
  })

  it('returns 400 when changing to a plan not in the catalog', async () => {
    const testUser = await getTestUser()
    const [inserted] = await testDb
      .insert(subscriptions)
      .values({
        userId: testUser.id,
        planId: 'pro',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date('2099-01-01'),
      })
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/subscriptions/${inserted.id}`,
      payload: { planId: 'unknown-plan' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('pastDueSince', () => {
  async function createVia(status: string) {
    const testUser = await getTestUser()
    const res = await app.inject({
      method: 'POST',
      url: '/subscriptions',
      payload: {
        userId: testUser.id,
        planId: 'pro',
        status,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date('2099-01-01').toISOString(),
      },
      headers: { cookie: authCookie },
    })
    return res.json()
  }

  function patch(id: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'PATCH',
      url: `/subscriptions/${id}`,
      payload,
      headers: { cookie: authCookie },
    })
  }

  it('is set when a subscription is created as past_due', async () => {
    const sub = await createVia('past_due')
    expect(sub.pastDueSince).not.toBeNull()
  })

  it('is null for other statuses', async () => {
    const sub = await createVia('active')
    expect(sub.pastDueSince).toBeNull()
  })

  it('is set when the status changes to past_due and kept while it stays', async () => {
    const sub = await createVia('active')
    const first = (await patch(sub.id, { status: 'past_due' })).json()
    expect(first.pastDueSince).not.toBeNull()

    const second = (
      await patch(sub.id, { status: 'past_due', planId: 'enterprise' })
    ).json()
    expect(second.pastDueSince).toBe(first.pastDueSince)
  })

  it('is kept when a patch does not touch the status', async () => {
    const sub = await createVia('past_due')
    const res = (await patch(sub.id, { planId: 'enterprise' })).json()
    expect(res.pastDueSince).toBe(sub.pastDueSince)
  })

  it('is cleared when the subscription leaves past_due', async () => {
    const sub = await createVia('past_due')
    const res = (await patch(sub.id, { status: 'active' })).json()
    expect(res.pastDueSince).toBeNull()
  })
})

describe('DELETE /subscriptions/:id', () => {
  it('returns 204 for existing subscription', async () => {
    const testUser = await getTestUser()
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
