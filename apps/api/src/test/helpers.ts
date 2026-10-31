import { eq, ne } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'

import { buildApp } from '@/app'
import { config } from '@/config'
import { ALL_PERMISSIONS } from '@/config/permissions'
import * as schema from '@/db/schema'
import {
  account,
  auditLogs,
  rolePermissions,
  roles,
  session,
  subscriptions,
  todos,
  uploads,
  user,
  verification,
} from '@/db/schema'
import { env } from '@/env'

const TEST_USER_EMAIL = 'test@test.com'
const TEST_ROLE_NAME = '__test_admin__'

export const testDb = drizzle(env.DATABASE_URL, {
  schema,
  casing: 'snake_case',
})

export function createTestApp() {
  return buildApp(testDb)
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

export async function cleanupUploads() {
  await testDb.delete(uploads)
}

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

  // When subscription mode is enabled, give the test user an active subscription
  // so routes protected by requireSubscription() pass without extra setup per test.
  if (config.subscriptions.enabled) {
    const [testUser] = await testDb
      .select()
      .from(user)
      .where(eq(user.email, TEST_USER_EMAIL))
    if (testUser) {
      const now = new Date()
      const far = new Date('2099-01-01')
      await testDb.insert(subscriptions).values({
        userId: testUser.id,
        planId: 'test',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: far,
      })
    }
  }

  const setCookie = res.headers['set-cookie']
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

export async function createRoleWithPermissions(
  grants: { resource: string; action: string }[]
) {
  const [role] = await testDb
    .insert(roles)
    .values({ name: `role-${Date.now()}` })
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
