import fastify from 'fastify'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAuditRecorder } from '../modules/audit/audit-recorder'
import type { AuditService } from '../modules/audit/audit-service'
import { registerAuditRequest } from './audit-request'

const mockUser = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@test.com',
  roleId: null,
}

function buildTestApp(auditService: AuditService) {
  const app = fastify()

  app.addHook('onRequest', async (request) => {
    request.sessionUser = mockUser
  })
  registerAuditRequest(app, createAuditRecorder(auditService, app.log))

  app.get('/test', async (request) => {
    await request.audit('create', 'todos', 'todo-1', { title: 'Buy milk' })
    return { ok: true }
  })

  app.get('/test-minimal', async (request) => {
    await request.audit('delete', 'todos')
    return { ok: true }
  })

  return app
}

describe('registerAuditRequest', () => {
  describe('when audit log succeeds', () => {
    const mockLog = vi.fn().mockResolvedValue(undefined)
    const app = buildTestApp({ log: mockLog } as unknown as AuditService)

    afterAll(() => app.close())
    beforeEach(() => mockLog.mockClear())

    it('calls auditService.log with all fields from sessionUser, params, and headers', async () => {
      await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'user-agent': 'TestAgent/1.0' },
      })

      expect(mockLog).toHaveBeenCalledOnce()
      expect(mockLog).toHaveBeenCalledWith({
        userId: mockUser.id,
        userName: mockUser.name,
        userEmail: mockUser.email,
        action: 'create',
        resource: 'todos',
        resourceId: 'todo-1',
        metadata: { title: 'Buy milk' },
        ip: expect.any(String),
        userAgent: 'TestAgent/1.0',
      })
    })

    it('passes null for resourceId when not provided', async () => {
      await app.inject({ method: 'GET', url: '/test-minimal' })

      expect(mockLog).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: null })
      )
    })

    it('passes null for metadata when not provided', async () => {
      await app.inject({ method: 'GET', url: '/test-minimal' })

      expect(mockLog).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: null })
      )
    })
  })

  describe('when auditService.log throws', () => {
    const mockLog = vi.fn().mockRejectedValue(new Error('DB down'))
    const app = buildTestApp({ log: mockLog } as unknown as AuditService)

    afterAll(() => app.close())

    it('does not propagate the error to the response', async () => {
      const res = await app.inject({ method: 'GET', url: '/test' })

      expect(res.statusCode).toBe(200)
    })
  })
})
