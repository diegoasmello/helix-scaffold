import { eq } from 'drizzle-orm'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { subscriptions, user } from '@/db/schema'
import { createAuditRecorder } from '@/modules/audit/audit-recorder'
import { createAuditService } from '@/modules/audit/audit-service'
import {
  cleanupAuditLogs,
  cleanupAuth,
  cleanupSubscriptions,
  createTestApp,
  findAuditLogs,
  testDb,
} from '@/test/helpers'

import { createSubscriptionExpirationJob } from './subscription-expiration'

const app = createTestApp()
const NOW = new Date('2026-06-15T12:00:00Z')

function createJob(database = testDb) {
  const logger = { info: vi.fn(), error: vi.fn() }
  const audit = createAuditRecorder(createAuditService(testDb), logger)
  return {
    run: createSubscriptionExpirationJob(database, audit, logger),
    logger,
  }
}

async function insertLapsedSubscription() {
  const email = `expiration-${crypto.randomUUID()}@test.com`
  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: JSON.stringify({ email, name: 'E', password: 'Password123!' }),
    headers: { 'content-type': 'application/json' },
  })
  const [owner] = await testDb.select().from(user).where(eq(user.email, email))
  const [sub] = await testDb
    .insert(subscriptions)
    .values({
      userId: owner.id,
      planId: 'pro',
      status: 'active',
      currentPeriodStart: new Date('2026-05-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-06-01T00:00:00Z'),
    })
    .returning()
  return sub
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

describe('subscription expiration job', () => {
  it('expires lapsed subscriptions and audits each one as the system', async () => {
    const sub = await insertLapsedSubscription()
    const { run, logger } = createJob()

    await run(NOW)

    const [row] = await testDb
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.id, sub.id))
    expect(row.status).toBe('expired')

    const entries = await findAuditLogs('edit', 'subscriptions', sub.id)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      userId: 'system:subscription-expiration',
      userEmail: 'system',
      metadata: { source: 'expiration-job', status: 'expired' },
    })
    expect(logger.info).toHaveBeenCalledWith(
      'Subscription expiration: expired 1 subscriptions'
    )
  })

  it('records nothing when no subscription lapsed', async () => {
    const { run, logger } = createJob()
    await run(NOW)
    expect(await testDb.select().from(subscriptions)).toHaveLength(0)
    expect(logger.info).not.toHaveBeenCalled()
  })

  it('logs a failed run instead of throwing', async () => {
    const failingDb = Object.create(testDb, {
      update: {
        value: () => {
          throw new Error('boom')
        },
      },
    }) as typeof testDb
    const { run, logger } = createJob(failingDb)

    await expect(run(NOW)).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'Subscription expiration failed'
    )
  })
})
