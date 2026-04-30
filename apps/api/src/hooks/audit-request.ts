import type { FastifyInstance } from 'fastify'

import type { AuditService } from '../modules/audit/audit-service'

export function registerAuditRequest(
  app: FastifyInstance,
  auditService: AuditService
) {
  app.addHook('onRequest', async (request) => {
    request.audit = async (action, resource, resourceId, metadata) => {
      await auditService
        .log({
          userId: request.sessionUser.id,
          userName: request.sessionUser.name,
          userEmail: request.sessionUser.email,
          action,
          resource,
          resourceId: resourceId ?? null,
          metadata: metadata ?? null,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        })
        .catch((err) => request.log.error({ err }, 'audit log failed'))
    }
  })
}
