import fastify from 'fastify'
import { afterAll, describe, expect, it, vi } from 'vitest'

import type { Auth } from '@/auth'

import { createRequireAuth } from './require-auth'

function buildTestApp(getSession: Auth['api']['getSession']) {
  const mockAuth = { api: { getSession } } as Auth
  const app = fastify()
  const requireAuth = createRequireAuth(mockAuth)

  app.get('/test', { preHandler: [requireAuth] }, async () => ({ ok: true }))

  return app
}

describe('requireAuth', () => {
  describe('when no session', () => {
    const app = buildTestApp(
      vi.fn().mockResolvedValue(null) as unknown as Auth['api']['getSession']
    )
    afterAll(() => app.close())

    it('returns 401 with Unauthorized message', async () => {
      const res = await app.inject({ method: 'GET', url: '/test' })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ message: 'Unauthorized' })
    })
  })

  describe('when session is valid', () => {
    const mockUser = {
      id: 'u1',
      name: 'Test',
      email: 'test@test.com',
      roleId: null,
    }
    const app = buildTestApp(
      vi.fn().mockResolvedValue({
        session: { id: 's1' },
        user: mockUser,
      }) as unknown as Auth['api']['getSession']
    )
    afterAll(() => app.close())

    it('calls the route handler', async () => {
      const res = await app.inject({ method: 'GET', url: '/test' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ ok: true })
    })
  })
})
