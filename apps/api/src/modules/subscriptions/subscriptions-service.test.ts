import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { subscriptions, user } from '@/db/schema'
import {
  cleanupAuth,
  cleanupSubscriptions,
  createTestApp,
  createTestSession,
  testDb,
} from '@/test/helpers'

import { createSubscriptionsService } from './subscriptions-service'

const app = createTestApp()
const service = createSubscriptionsService(testDb)

const NOW = new Date('2026-06-15T12:00:00Z')
const PAST = new Date('2026-06-01T00:00:00Z')
const FUTURE = new Date('2026-07-01T00:00:00Z')

// The live-subscription index allows one active/trialing row per user,
// so each case gets its own user.
async function createUser(email: string) {
  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: JSON.stringify({ email, name: email, password: 'Password123!' }),
    headers: { 'content-type': 'application/json' },
  })
  const [created] = await testDb
    .select()
    .from(user)
    .where(eq(user.email, email))
  return created.id
}

async function insertSubscription(
  values: Partial<typeof subscriptions.$inferInsert>
) {
  const userId = await createUser(`expire-${crypto.randomUUID()}@test.com`)
  const [sub] = await testDb
    .insert(subscriptions)
    .values({
      userId,
      planId: 'pro',
      status: 'active',
      currentPeriodStart: PAST,
      currentPeriodEnd: FUTURE,
      ...values,
    })
    .returning()
  return sub
}

async function statusOf(id: string) {
  const [sub] = await testDb
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
  return sub.status
}

beforeAll(async () => {
  await cleanupAuth()
  await createTestSession(app)
})

beforeEach(async () => {
  await cleanupSubscriptions()
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

describe('expireLapsed', () => {
  it('expires a trial past trialEndsAt', async () => {
    const sub = await insertSubscription({
      status: 'trialing',
      trialEndsAt: PAST,
    })
    const { expired } = await service.expireLapsed(NOW)
    expect(expired).toBe(1)
    expect(await statusOf(sub.id)).toBe('expired')
  })

  it('uses currentPeriodEnd for a trial without trialEndsAt', async () => {
    const sub = await insertSubscription({
      status: 'trialing',
      currentPeriodEnd: PAST,
    })
    await service.expireLapsed(NOW)
    expect(await statusOf(sub.id)).toBe('expired')
  })

  it('expires an active subscription past currentPeriodEnd', async () => {
    const sub = await insertSubscription({ currentPeriodEnd: PAST })
    await service.expireLapsed(NOW)
    expect(await statusOf(sub.id)).toBe('expired')
  })

  it('keeps subscriptions whose period has not ended', async () => {
    const trial = await insertSubscription({
      status: 'trialing',
      trialEndsAt: FUTURE,
    })
    const active = await insertSubscription({})
    const { expired } = await service.expireLapsed(NOW)
    expect(expired).toBe(0)
    expect(await statusOf(trial.id)).toBe('trialing')
    expect(await statusOf(active.id)).toBe('active')
  })

  it('leaves processor-managed subscriptions (with externalId) untouched', async () => {
    const sub = await insertSubscription({
      currentPeriodEnd: PAST,
      externalId: 'sub_123',
    })
    await service.expireLapsed(NOW)
    expect(await statusOf(sub.id)).toBe('active')
  })

  it('ignores subscriptions that are not live', async () => {
    const sub = await insertSubscription({
      status: 'past_due',
      currentPeriodEnd: PAST,
    })
    await service.expireLapsed(NOW)
    expect(await statusOf(sub.id)).toBe('past_due')
  })
})

describe('getAccessGrantingByUserId — past_due grace', () => {
  const DAY = 24 * 60 * 60 * 1000

  it('returns a past_due subscription inside the grace window', async () => {
    const sub = await insertSubscription({
      status: 'past_due',
      pastDueSince: new Date(NOW.getTime() - 2 * DAY),
    })
    const found = await service.getAccessGrantingByUserId(sub.userId, {
      now: NOW,
      pastDueGraceDays: 3,
    })
    expect(found?.id).toBe(sub.id)
  })

  it('ignores it once the grace window has passed', async () => {
    const sub = await insertSubscription({
      status: 'past_due',
      pastDueSince: new Date(NOW.getTime() - 4 * DAY),
    })
    const found = await service.getAccessGrantingByUserId(sub.userId, {
      now: NOW,
      pastDueGraceDays: 3,
    })
    expect(found).toBeNull()
  })

  it('ignores past_due entirely when the grace period is 0', async () => {
    const sub = await insertSubscription({
      status: 'past_due',
      pastDueSince: NOW,
    })
    const found = await service.getAccessGrantingByUserId(sub.userId, {
      now: NOW,
      pastDueGraceDays: 0,
    })
    expect(found).toBeNull()
  })

  it('prefers a live subscription over a past_due one', async () => {
    const pastDue = await insertSubscription({
      status: 'past_due',
      pastDueSince: NOW,
    })
    const [live] = await testDb
      .insert(subscriptions)
      .values({
        userId: pastDue.userId,
        planId: 'pro',
        status: 'active',
        currentPeriodStart: PAST,
        currentPeriodEnd: FUTURE,
        createdAt: new Date(NOW.getTime() - 10 * DAY),
      })
      .returning()
    const found = await service.getAccessGrantingByUserId(pastDue.userId, {
      now: NOW,
      pastDueGraceDays: 3,
    })
    expect(found?.id).toBe(live.id)
  })
})
