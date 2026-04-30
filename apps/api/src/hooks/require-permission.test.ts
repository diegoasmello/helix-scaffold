import fastify from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { cleanupRoles, createRoleWithPermissions, testDb } from '@/test/helpers'

import { createRequirePermission } from './require-permission'

const requirePermission = createRequirePermission(testDb)

let currentRoleId: string | null = null

const app = fastify()
app.get(
  '/test',
  {
    preHandler: [
      async (request) => {
        request.sessionUser = {
          id: 'u1',
          name: 'Test',
          email: 't@t.com',
          roleId: currentRoleId,
        }
      },
      requirePermission('foo', 'bar'),
    ],
  },
  async () => ({ ok: true })
)

beforeEach(async () => {
  await cleanupRoles()
})

afterAll(async () => {
  await cleanupRoles()
  await app.close()
})

describe('requirePermission', () => {
  it('returns 403 when sessionUser has no roleId', async () => {
    currentRoleId = null
    const res = await app.inject({ method: 'GET', url: '/test' })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ message: 'Forbidden' })
  })

  it('returns 403 when role has no matching permission', async () => {
    const role = await createRoleWithPermissions([])
    currentRoleId = role.id
    const res = await app.inject({ method: 'GET', url: '/test' })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ message: 'Forbidden' })
  })

  it('calls the route handler when role has the required permission', async () => {
    const role = await createRoleWithPermissions([
      { resource: 'foo', action: 'bar' },
    ])
    currentRoleId = role.id
    const res = await app.inject({ method: 'GET', url: '/test' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})
