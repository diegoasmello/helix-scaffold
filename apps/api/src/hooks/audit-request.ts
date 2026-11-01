import type { FastifyInstance } from 'fastify'

import type { AuditRecorder } from '../modules/audit/audit-recorder'

/**
 * Attaches `request.audit(action, resource, resourceId?, metadata?)`: the
 * audit recorder with the signed-in user (plus IP and user agent) as actor.
 */
export function registerAuditRequest(
  app: FastifyInstance,
  recorder: AuditRecorder
) {
  app.addHook('onRequest', async (request) => {
    request.audit = (action, resource, resourceId, metadata) =>
      recorder.record(
        {
          kind: 'user',
          id: request.sessionUser.id,
          name: request.sessionUser.name,
          email: request.sessionUser.email,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        },
        { action, resource, resourceId, metadata }
      )
  })
}
