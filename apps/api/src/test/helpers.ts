import { and, eq, ne } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'

import { buildApp } from '@/app'
import { type AppConfig, config, overrideConfig } from '@/config'
import { ALL_PERMISSIONS } from '@/config/permissions'
import * as schema from '@/db/schema'
import {
  account,
  auditLogs,
  rolePermissions,
  roles,
  session,
  subscriptions,
  TODO_NORMALIZED_FIELDS,
  TODO_SLUG,
  todos,
  uploads,
  user,
  verification,
} from '@/db/schema'
import { env } from '@/env'
import { normalizedValues } from '@/lib/normalize-text'
import { slugBase } from '@/lib/slug'

const TEST_USER_EMAIL = 'test@test.com'
export const TEST_ROLE_NAME = '__test_admin__'

export const testDb = drizzle(env.DATABASE_URL, {
  schema,
  casing: 'snake_case',
})

/** The user created by `createTestSession()` — look it up by email, never by row order. */
export async function getTestUser() {
  const [testUser] = await testDb
    .select()
    .from(user)
    .where(eq(user.email, TEST_USER_EMAIL))
  return testUser
}

/**
 * `buildApp(testDb)` with the test config (src/config/test-overrides.ts:
 * open registration, subscriptions on). Pass overrides to run another mode —
 * e.g. the defaults a product ships with:
 * `createTestApp({ registration: { mode: 'closed' }, subscriptions: { enabled: false } })`.
 */
export function createTestApp(overrides?: AppConfig) {
  return buildApp(testDb, {
    config: overrides ? overrideConfig(config, overrides) : config,
  })
}

export async function cleanupAuditLogs() {
  await testDb.delete(auditLogs)
}

export async function cleanupRoles() {
  await testDb.delete(roles).where(ne(roles.name, TEST_ROLE_NAME))
}

export async function cleanupUsers() {
  await testDb.delete(user).where(ne(user.email, TEST_USER_EMAIL))
}

export async function cleanupAuth() {
  await testDb.delete(session)
  await testDb.delete(account)
  await testDb.delete(verification)
  await testDb.delete(user)
  // roles deleted via FK cascade on rolePermissions; delete manually in right order
  await testDb.delete(roles)
}

export async function cleanupSubscriptions() {
  await testDb.delete(subscriptions)
}

export async function cleanupTodos() {
  await testDb.delete(todos)
}

type TodoInsert = typeof todos.$inferInsert

/**
 * A row for `testDb.insert(todos)`, with the normalized columns filled the
 * way the service fills them — tests never write `normalizedTitle` by hand.
 * `slug` defaults to the title's slug plus a random suffix, so rows with the
 * same title never collide; pass it when the test looks a row up by slug.
 */
export function todoRow(
  values: Omit<
    TodoInsert,
    | (typeof TODO_NORMALIZED_FIELDS)[keyof typeof TODO_NORMALIZED_FIELDS]
    | 'slug'
  > & { slug?: string }
): TodoInsert {
  return {
    ...values,
    ...normalizedValues(values, TODO_NORMALIZED_FIELDS),
    slug:
      values.slug ??
      `${slugBase(values.title, TODO_SLUG)}-${crypto.randomUUID().slice(0, 8)}`,
  }
}

export async function cleanupUploads() {
  await testDb.delete(uploads)
}

/** Signs up the test admin over HTTP, so `app` needs open registration. */
export async function createTestSession(
  app: ReturnType<typeof buildApp>
): Promise<string> {
  // Ensure test admin role exists with all permissions
  let [testRole] = await testDb
    .select()
    .from(roles)
    .where(eq(roles.name, TEST_ROLE_NAME))

  if (!testRole) {
    ;[testRole] = await testDb
      .insert(roles)
      .values({ name: TEST_ROLE_NAME, description: 'Test admin role' })
      .returning()

    await testDb.insert(rolePermissions).values(
      ALL_PERMISSIONS.map(({ resource, action }) => ({
        roleId: testRole.id,
        resource,
        action,
      }))
    )
  }

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: JSON.stringify({
      email: TEST_USER_EMAIL,
      name: 'Test User',
      password: 'Password123!',
    }),
    headers: { 'content-type': 'application/json' },
  })

  // Assign the test role to the created user
  await testDb
    .update(user)
    .set({ roleId: testRole.id })
    .where(eq(user.email, TEST_USER_EMAIL))

  // An active subscription, so routes protected by requireSubscription() pass
  // without extra setup per test. Harmless when the app has subscriptions off.
  await grantActiveSubscription(TEST_USER_EMAIL)

  const setCookie = res.headers['set-cookie']
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

/**
 * Gives the user an active subscription (default plan `pro`, which unlocks
 * `todos` in test-overrides.ts). Permission tests on a subscription-gated route
 * need it: without one, `requireSubscription()` answers 403 before
 * `requirePermission()` runs, and the test passes for the wrong reason.
 */
export async function grantActiveSubscription(email: string, planId = 'pro') {
  const [target] = await testDb.select().from(user).where(eq(user.email, email))
  if (!target) throw new Error(`grantActiveSubscription: no user ${email}`)
  await testDb.insert(subscriptions).values({
    userId: target.id,
    planId,
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date('2099-01-01'),
  })
}

/** Audit entries written for one action on one record. */
export async function findAuditLogs(
  action: string,
  resource: string,
  resourceId: string
) {
  return testDb
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, action),
        eq(auditLogs.resource, resource),
        eq(auditLogs.resourceId, resourceId)
      )
    )
}

export async function createRoleWithPermissions(
  grants: { resource: string; action: string }[]
) {
  const [role] = await testDb
    .insert(roles)
    .values({ name: `role-${crypto.randomUUID()}` })
    .returning()

  if (grants.length > 0) {
    await testDb.insert(rolePermissions).values(
      grants.map(({ resource, action }) => ({
        roleId: role.id,
        resource,
        action,
      }))
    )
  }

  return role
}

/**
 * The admin role (`isAdmin`: every permission, locked), as the bootstrap
 * creates it — at most one exists. The test admin role is not it: it only
 * holds every permission, like a moderator granted everything.
 */
export async function createAdminRole() {
  const [role] = await testDb
    .insert(roles)
    .values({ name: `admin-${crypto.randomUUID()}`, isAdmin: true })
    .returning()
  return role
}

/**
 * Signs up a fresh user, gives them `roleId` and returns their Cookie header.
 * Pair it with `createRoleWithPermissions` to act as a user holding exactly
 * those grants (a delegated moderator, say).
 */
export async function createSessionWithRole(
  app: ReturnType<typeof buildApp>,
  roleId: string
): Promise<string> {
  const email = `session-${crypto.randomUUID()}@test.com`
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, name: 'Session user', password: 'Password123!' },
  })
  await testDb.update(user).set({ roleId }).where(eq(user.email, email))
  const setCookie = res.headers['set-cookie']
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
  return cookies.map((c) => c.split(';')[0]).join('; ')
}
