import { createHmac } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildApp } from '@/app'
import { auditLogs, subscriptions, user } from '@/db/schema'
import {
  cleanupAuditLogs,
  cleanupAuth,
  cleanupSubscriptions,
  createTestApp,
  testDb,
} from '@/test/helpers'

import { createHmacJsonAdapter } from './hmac-json-adapter'

const SECRET = 'test-webhook-secret'
const app = buildApp(testDb, {
  billingWebhookAdapter: createHmacJsonAdapter({ secret: SECRET }),
})

function sign(body: string) {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`
}

function send(payload: unknown, signature?: string) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return app.inject({
    method: 'POST',
    url: '/webhooks/billing',
    payload: body,
    headers: {
      'content-type': 'application/json',
      'x-billing-signature': signature ?? sign(body),
    },
  })
}

async function createUser() {
  const email = `billing-${crypto.randomUUID()}@test.com`
  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: JSON.stringify({
      email,
      name: 'Billing',
      password: 'Password123!',
    }),
    headers: { 'content-type': 'application/json' },
  })
  const [created] = await testDb
    .select()
    .from(user)
    .where(eq(user.email, email))
  return created.id
}

function state(overrides: Record<string, unknown> = {}) {
  return {
    externalId: 'sub_123',
    planId: 'pro',
    status: 'active',
    currentPeriodStart: '2026-01-01T00:00:00.000Z',
    currentPeriodEnd: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

async function findByExternalId(externalId: string) {
  return testDb
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.externalId, externalId))
}

beforeAll(async () => {
  await cleanupAuth()
})

beforeEach(async () => {
  await cleanupSubscriptions()
  await cleanupAuditLogs()
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

describe('POST /webhooks/billing — registration', () => {
  it('is not registered when no adapter is configured', async () => {
    const appWithoutAdapter = createTestApp()
    const res = await appWithoutAdapter.inject({
      method: 'POST',
      url: '/webhooks/billing',
      payload: '{}',
      headers: { 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(404)
    await appWithoutAdapter.close()
  })

  it('is hidden from the OpenAPI spec', async () => {
    await app.ready()
    const spec = app.swagger() as { paths: Record<string, unknown> }
    expect(spec.paths['/webhooks/billing']).toBeUndefined()
  })
})

describe('POST /webhooks/billing — verification', () => {
  it('returns 401 for a wrong signature', async () => {
    const res = await send({ subscriptions: [] }, 'sha256=deadbeef')
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 without a signature header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/billing',
      payload: '{"subscriptions":[]}',
      headers: { 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for a body that is not JSON', async () => {
    const res = await send('not json')
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for a payload in the wrong shape', async () => {
    const res = await send({ subscriptions: [{ externalId: 'sub_1' }] })
    expect(res.statusCode).toBe(400)
  })

  it('returns 200 for a verified delivery with nothing to sync', async () => {
    const res = await send({ subscriptions: [] })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ received: true })
  })
})

describe('POST /webhooks/billing — sync', () => {
  it('creates the subscription the first time an externalId is seen', async () => {
    const userId = await createUser()
    const res = await send({ subscriptions: [state({ userId })] })
    expect(res.statusCode).toBe(200)

    const [sub] = await findByExternalId('sub_123')
    expect(sub).toMatchObject({ userId, planId: 'pro', status: 'active' })
  })

  it('updates the existing subscription and keeps its user', async () => {
    const userId = await createUser()
    await send({ subscriptions: [state({ userId })] })
    await send({ subscriptions: [state({ status: 'past_due' })] })

    const rows = await findByExternalId('sub_123')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ userId, status: 'past_due' })
  })

  it('is idempotent when the same delivery arrives twice', async () => {
    const userId = await createUser()
    const payload = { subscriptions: [state({ userId })] }
    await send(payload)
    await send(payload)
    expect(await findByExternalId('sub_123')).toHaveLength(1)
  })

  it('keeps stored optional fields that the payload omits', async () => {
    const userId = await createUser()
    await send({
      subscriptions: [state({ userId, metadata: { customer: 'cus_1' } })],
    })
    await send({ subscriptions: [state({ planId: 'enterprise' })] })

    const [sub] = await findByExternalId('sub_123')
    expect(sub.planId).toBe('enterprise')
    expect(sub.metadata).toEqual({ customer: 'cus_1' })
  })

  it("cancels the user's other live subscription (e.g. the sign-up trial)", async () => {
    const userId = await createUser()
    const [trial] = await testDb
      .insert(subscriptions)
      .values({
        userId,
        planId: 'pro',
        status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date('2099-01-01'),
      })
      .returning()

    const res = await send({ subscriptions: [state({ userId })] })
    expect(res.statusCode).toBe(200)

    const [canceledTrial] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, trial.id))
    expect(canceledTrial.status).toBe('canceled')
    expect(canceledTrial.canceledAt).not.toBeNull()
    const [paid] = await findByExternalId('sub_123')
    expect(paid.status).toBe('active')
  })

  it('syncs several subscriptions in one delivery', async () => {
    const [a, b] = [await createUser(), await createUser()]
    await send({
      subscriptions: [
        state({ externalId: 'sub_a', userId: a }),
        state({ externalId: 'sub_b', userId: b }),
      ],
    })
    expect(await findByExternalId('sub_a')).toHaveLength(1)
    expect(await findByExternalId('sub_b')).toHaveLength(1)
  })

  it('records an audit entry with the webhook as actor', async () => {
    const userId = await createUser()
    await send({ subscriptions: [state({ userId })] })

    const [entry] = await testDb.select().from(auditLogs)
    expect(entry).toMatchObject({
      userId: 'system:hmac-json',
      userName: 'Billing webhook (hmac-json)',
      action: 'create',
      resource: 'subscriptions',
    })
  })
})

describe('POST /webhooks/billing — skipped states (200, nothing written)', () => {
  it('skips a plan that is not in the catalog', async () => {
    const userId = await createUser()
    const res = await send({
      subscriptions: [state({ userId, planId: 'price_unmapped' })],
    })
    expect(res.statusCode).toBe(200)
    expect(await findByExternalId('sub_123')).toHaveLength(0)
  })

  it('skips a new subscription without userId', async () => {
    const res = await send({ subscriptions: [state()] })
    expect(res.statusCode).toBe(200)
    expect(await findByExternalId('sub_123')).toHaveLength(0)
  })

  it('skips a userId that does not exist', async () => {
    const res = await send({
      subscriptions: [state({ userId: 'nonexistent-user' })],
    })
    expect(res.statusCode).toBe(200)
    expect(await findByExternalId('sub_123')).toHaveLength(0)
  })

  it('still syncs the valid states of a delivery', async () => {
    const userId = await createUser()
    await send({
      subscriptions: [
        state({ externalId: 'sub_bad', planId: 'price_unmapped', userId }),
        state({ externalId: 'sub_good', userId }),
      ],
    })
    expect(await findByExternalId('sub_bad')).toHaveLength(0)
    expect(await findByExternalId('sub_good')).toHaveLength(1)
  })
})
