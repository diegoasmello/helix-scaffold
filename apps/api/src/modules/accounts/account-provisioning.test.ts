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

import { createAuth } from '@/auth'
import { config } from '@/config'
import { rolePermissions, roles, subscriptions, user } from '@/db/schema'
import { createEmailProvider } from '@/lib/email'
import {
  cleanupAuth,
  cleanupRoles,
  cleanupUsers,
  createRoleWithPermissions,
  createTestApp,
  createTestSession,
  grantActiveSubscription,
  testDb,
} from '@/test/helpers'

import {
  applySelfRegistrationDefaults,
  createAccountProvisioning,
  ensureDefaultRole,
  RoleNotFoundError,
} from './account-provisioning'

const app = createTestApp()
let authCookie = ''

const open = { registration: { mode: 'open' as const } }
const closed = { registration: { mode: 'closed' as const } }
const noTrial = { enabled: true, trial: false as const }

function createAuthFor(database: typeof testDb) {
  return createAuth(
    database,
    createEmailProvider({
      enabled: true,
      from: 'test@test.com',
      nodeEnv: 'test',
    }),
    config,
    { error: vi.fn(), warn: vi.fn() }
  )
}

const provisioning = createAccountProvisioning(
  testDb,
  createAuthFor(testDb),
  config
)

beforeAll(async () => {
  await cleanupAuth()
  authCookie = await createTestSession(app)
})

beforeEach(async () => {
  await cleanupUsers()
  await cleanupRoles()
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

async function findUser(email: string) {
  const [found] = await testDb.select().from(user).where(eq(user.email, email))
  return found
}

async function insertDefaultRole() {
  const [role] = await testDb
    .insert(roles)
    .values({ name: 'Default', isDefault: true })
    .returning()
  return role
}

async function insertUser(email: string) {
  const [inserted] = await testDb
    .insert(user)
    .values({ id: email, name: 'U', email, emailVerified: false })
    .returning()
  return inserted
}

async function subscriptionsOf(userId: string) {
  return testDb
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
}

describe('self-registered (better-auth hook, open registration)', () => {
  it('gives a self-registered user the default role', async () => {
    const defaultRole = await insertDefaultRole()
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
    expect((await findUser('self@test.com')).roleId).toBe(defaultRole.id)
  })

  it('leaves a user created by an admin without the default role', async () => {
    await insertDefaultRole()
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
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
    expect(await subscriptionsOf(created.id)).toHaveLength(0)
  })
})

describe('applySelfRegistrationDefaults', () => {
  it('starts a trial when one is configured', async () => {
    const defaultRole = await insertDefaultRole()
    const target = await insertUser('trial@test.com')

    await applySelfRegistrationDefaults(
      testDb,
      target.id,
      {
        ...open,
        subscriptions: { enabled: true, trial: { days: 14, planId: 'pro' } },
      },
      { error: vi.fn(), warn: vi.fn() }
    )

    const [trial] = await subscriptionsOf(target.id)
    expect(trial).toMatchObject({ planId: 'pro', status: 'trialing' })
    const days =
      (trial.currentPeriodEnd.getTime() - trial.currentPeriodStart.getTime()) /
      86_400_000
    expect(Math.round(days)).toBe(14)
    expect((await findUser('trial@test.com')).roleId).toBe(defaultRole.id)
  })

  it('logs a failed trial instead of failing the sign-up', async () => {
    await insertDefaultRole()
    const target = await insertUser('livesub@test.com')
    // A live subscription already exists: the partial unique index rejects
    // a second one, so the trial insert fails
    await grantActiveSubscription('livesub@test.com')
    const logger = { error: vi.fn(), warn: vi.fn() }

    await expect(
      applySelfRegistrationDefaults(
        testDb,
        target.id,
        {
          ...open,
          subscriptions: { enabled: true, trial: { days: 14, planId: 'pro' } },
        },
        logger
      )
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: target.id }),
      'Trial subscription creation failed'
    )
  })

  it('starts no trial when trials are off', async () => {
    await insertDefaultRole()
    const target = await insertUser('notrial@test.com')

    await applySelfRegistrationDefaults(
      testDb,
      target.id,
      { ...open, subscriptions: noTrial },
      { error: vi.fn(), warn: vi.fn() }
    )

    expect(await subscriptionsOf(target.id)).toHaveLength(0)
  })

  it('warns when no role is marked as default', async () => {
    const target = await insertUser('norole@test.com')
    const logger = { error: vi.fn(), warn: vi.fn() }

    await applySelfRegistrationDefaults(
      testDb,
      target.id,
      { ...open, subscriptions: noTrial },
      logger
    )

    expect((await findUser('norole@test.com')).roleId).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      { userId: target.id },
      'Self-registered user got no role: no role is marked as default'
    )
  })

  it('does nothing in closed registration', async () => {
    await insertDefaultRole()
    const target = await insertUser('closed@test.com')

    await applySelfRegistrationDefaults(
      testDb,
      target.id,
      {
        ...closed,
        subscriptions: { enabled: true, trial: { days: 14, planId: 'pro' } },
      },
      { error: vi.fn(), warn: vi.fn() }
    )

    expect((await findUser('closed@test.com')).roleId).toBeNull()
    expect(await subscriptionsOf(target.id)).toHaveLength(0)
  })
})

describe('ensureDefaultRole', () => {
  async function defaultRoles() {
    return testDb.select().from(roles).where(eq(roles.isDefault, true))
  }

  it('creates an empty "User" default role in open registration', async () => {
    await ensureDefaultRole(testDb, open)
    const [role] = await defaultRoles()
    expect(role.name).toBe('User')
    expect(
      await testDb
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id))
    ).toHaveLength(0)
  })

  it('promotes an existing "User" role, keeping its permissions', async () => {
    const [existing] = await testDb
      .insert(roles)
      .values({ name: 'User' })
      .returning()
    await testDb
      .insert(rolePermissions)
      .values({ roleId: existing.id, resource: 'audit', action: 'view' })

    await ensureDefaultRole(testDb, open)

    const [role] = await defaultRoles()
    expect(role.id).toBe(existing.id)
    expect(
      await testDb
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id))
    ).toHaveLength(1)
  })

  it('keeps a role already marked as default', async () => {
    const existing = await insertDefaultRole()
    await ensureDefaultRole(testDb, open)
    expect((await defaultRoles()).map((r) => r.id)).toEqual([existing.id])
  })

  it('does nothing in closed registration', async () => {
    await ensureDefaultRole(testDb, closed)
    expect(await defaultRoles()).toHaveLength(0)
  })
})

describe('provisionAccount', () => {
  const account = { name: 'New', password: 'Password123!' }

  it('creates the account with the given role', async () => {
    const role = await createRoleWithPermissions([])
    const userId = await provisioning.provisionAccount({
      ...account,
      email: 'with-role@test.com',
      roleId: role.id,
    })
    const created = await findUser('with-role@test.com')
    expect(created.id).toBe(userId)
    expect(created.roleId).toBe(role.id)
  })

  it('creates the account without a role, and never the default one', async () => {
    await insertDefaultRole()
    await provisioning.provisionAccount({
      ...account,
      email: 'no-role@test.com',
    })
    const created = await findUser('no-role@test.com')
    expect(created.roleId).toBeNull()
    expect(await subscriptionsOf(created.id)).toHaveLength(0)
  })

  it('rejects an unknown role before creating anything', async () => {
    await expect(
      provisioning.provisionAccount({
        ...account,
        email: 'unknown-role@test.com',
        roleId: 'missing-role',
      })
    ).rejects.toBeInstanceOf(RoleNotFoundError)
    expect(await findUser('unknown-role@test.com')).toBeUndefined()
  })

  it('leaves no user behind when the role assignment fails', async () => {
    const role = await createRoleWithPermissions([])
    // Same database, but the role assignment fails — after better-auth has
    // already created the user
    const failingDb = Object.create(testDb, {
      update: {
        value: () => {
          throw new Error('boom')
        },
      },
    }) as typeof testDb
    const failing = createAccountProvisioning(
      failingDb,
      createAuthFor(testDb),
      config
    )

    await expect(
      failing.provisionAccount({
        ...account,
        email: 'half@test.com',
        roleId: role.id,
      })
    ).rejects.toThrow('boom')
    expect(await findUser('half@test.com')).toBeUndefined()
  })
})
