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

import { roles, subscriptions, user } from '@/db/schema'
import {
  cleanupAuth,
  cleanupRoles,
  cleanupUsers,
  createTestApp,
  createTestSession,
  grantActiveSubscription,
  testDb,
} from '@/test/helpers'

import { applySelfRegistrationDefaults } from './self-registration'

const app = createTestApp()
let authCookie = ''
let defaultRoleId = ''

beforeAll(async () => {
  await cleanupAuth()
  authCookie = await createTestSession(app)
})

beforeEach(async () => {
  await cleanupUsers()
  await cleanupRoles()
  const [role] = await testDb
    .insert(roles)
    .values({ name: 'Default', isDefault: true })
    .returning()
  defaultRoleId = role.id
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

async function findUser(email: string) {
  const [found] = await testDb.select().from(user).where(eq(user.email, email))
  return found
}

describe('user creation hook (open registration)', () => {
  it('gives a self-registered user the default role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: JSON.stringify({
        email: 'self@test.com',
        name: 'Self',
        password: 'Password123!',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(200)
    expect((await findUser('self@test.com')).roleId).toBe(defaultRoleId)
  })

  it('leaves a user created by an admin without the default role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Created',
        email: 'created@test.com',
        password: 'Password123!',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(201)
    const created = await findUser('created@test.com')
    expect(created.roleId).toBeNull()
    expect(
      await testDb
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, created.id))
    ).toHaveLength(0)
  })
})

describe('applySelfRegistrationDefaults', () => {
  async function insertUser(email: string) {
    const [inserted] = await testDb
      .insert(user)
      .values({ id: email, name: 'U', email, emailVerified: false })
      .returning()
    return inserted
  }

  it('starts a trial when one is configured', async () => {
    const target = await insertUser('trial@test.com')

    await applySelfRegistrationDefaults(
      testDb,
      target.id,
      { enabled: true, trial: { days: 14, planId: 'pro' } },
      { error: vi.fn() }
    )

    const [trial] = await testDb
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, target.id))
    expect(trial).toMatchObject({ planId: 'pro', status: 'trialing' })
    const days =
      (trial.currentPeriodEnd.getTime() - trial.currentPeriodStart.getTime()) /
      86_400_000
    expect(Math.round(days)).toBe(14)
    expect((await findUser('trial@test.com')).roleId).toBe(defaultRoleId)
  })

  it('logs a failed trial instead of failing the sign-up', async () => {
    const target = await insertUser('livesub@test.com')
    // A live subscription already exists: the partial unique index rejects
    // a second one, so the trial insert fails
    await grantActiveSubscription('livesub@test.com')
    const logger = { error: vi.fn() }

    await expect(
      applySelfRegistrationDefaults(
        testDb,
        target.id,
        { enabled: true, trial: { days: 14, planId: 'pro' } },
        logger
      )
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: target.id }),
      'Trial subscription creation failed'
    )
  })

  it('starts no trial when trials are off', async () => {
    const target = await insertUser('notrial@test.com')

    await applySelfRegistrationDefaults(
      testDb,
      target.id,
      { enabled: true, trial: false },
      { error: vi.fn() }
    )

    expect(
      await testDb
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, target.id))
    ).toHaveLength(0)
  })
})
