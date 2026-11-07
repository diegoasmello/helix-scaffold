import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createAuth } from '@/auth'
import { config } from '@/config'
import { createEmailProvider } from '@/lib/email'
import { createAuditRecorder } from '@/modules/audit/audit-recorder'
import { createAuditService } from '@/modules/audit/audit-service'
import {
  cleanupRoles,
  cleanupUsers,
  createAdminRole,
  createRoleWithPermissions,
  createSessionWithRole,
  createTestApp,
  findAuditLogs,
  testDb,
} from '@/test/helpers'

import { resetAdminPassword } from './password-replacement'

// `createSessionWithRole()` signs users up over HTTP.
const app = createTestApp()
const auth = createAuth(
  testDb,
  createEmailProvider({ enabled: false, from: 'a@b.test', nodeEnv: 'test' }),
  config,
  { error: vi.fn(), warn: vi.fn() }
)
const audit = createAuditRecorder(createAuditService(testDb), {
  error: vi.fn(),
})

afterEach(async () => {
  await cleanupUsers()
  await cleanupRoles()
})

afterAll(async () => {
  await app.close()
})

async function signedIn(roleId: string) {
  const cookie = await createSessionWithRole(app, roleId)
  const me = await app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { cookie },
  })
  const { id, email } = me.json<{ id: string; email: string }>()
  return { cookie, id, email }
}

function signIn(email: string, password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email, password },
  })
}

describe('resetAdminPassword (pnpm admin:reset-password)', () => {
  it('gives the admin a new random password and signs them out everywhere', async () => {
    const admin = await signedIn((await createAdminRole()).id)

    const result = await resetAdminPassword(
      testDb,
      auth,
      audit,
      `  ${admin.email.toUpperCase()} `
    )

    expect(result.status).toBe('reset')
    if (result.status !== 'reset') return
    expect(result.password.length).toBeGreaterThanOrEqual(20)
    expect((await signIn(admin.email, result.password)).statusCode).toBe(200)
    expect((await signIn(admin.email, 'Password123!')).statusCode).toBe(401)
    const me = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: admin.cookie },
    })
    expect(me.statusCode).toBe(401)
    const [entry] = await findAuditLogs('edit', 'users', admin.id)
    expect(entry.userId).toBe('system:cli')
    expect(entry.metadata).toEqual({ passwordChanged: true })
  })

  it('refuses any account but the admin', async () => {
    const other = await signedIn(
      (await createRoleWithPermissions([{ resource: 'users', action: 'view' }]))
        .id
    )

    const result = await resetAdminPassword(testDb, auth, audit, other.email)

    expect(result).toEqual({ status: 'not_admin' })
    expect((await signIn(other.email, 'Password123!')).statusCode).toBe(200)
    expect(await findAuditLogs('edit', 'users', other.id)).toHaveLength(0)
  })

  it('reports an unknown email', async () => {
    const result = await resetAdminPassword(
      testDb,
      auth,
      audit,
      `nobody-${crypto.randomUUID()}@test.com`
    )

    expect(result).toEqual({ status: 'not_found' })
  })
})
