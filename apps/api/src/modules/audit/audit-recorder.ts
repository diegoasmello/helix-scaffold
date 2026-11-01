import type { RESOURCE_DEFINITIONS } from '@/config/permissions'

import type { AuditService } from './audit-service'

export type AuditAction = 'create' | 'edit' | 'delete' | 'export'

/** An RBAC resource (`src/config/permissions.ts`), or `me` for the profile. */
export type AuditResource =
  | (typeof RESOURCE_DEFINITIONS)[number]['resource']
  | 'me'

/**
 * Who did it. A signed-in user, or the system acting on its own — a
 * background job, a payment processor webhook, the bootstrap.
 */
export type AuditActor =
  | {
      kind: 'user'
      id: string
      name: string
      email: string
      ip?: string | null
      userAgent?: string | null
    }
  | {
      kind: 'system'
      /** Stable id, stored as `system:<id>` in `audit_logs.user_id`. */
      id: string
      /** Shown as the user name in the audit log. */
      name: string
      ip?: string | null
      userAgent?: string | null
    }

export interface AuditEntry {
  action: AuditAction
  resource: AuditResource
  resourceId?: string | null
  metadata?: unknown
}

/** The slice of a pino/Fastify logger this module needs. */
interface AuditLogger {
  error: (obj: object, msg: string) => void
}

/** A system actor — `id` becomes `system:<id>` in the log. */
export function systemActor(
  id: string,
  name: string,
  origin: { ip?: string | null; userAgent?: string | null } = {}
): AuditActor {
  return { kind: 'system', id, name, ...origin }
}

/**
 * Writes audit entries. **Best-effort:** a failed write is logged and never
 * thrown, so auditing can never fail the action it records. Every entry goes
 * through here — `request.audit()` for signed-in users, `record()` with a
 * `systemActor()` for everything else.
 */
export function createAuditRecorder(
  auditService: Pick<AuditService, 'log'>,
  logger: AuditLogger
) {
  async function record(actor: AuditActor, entry: AuditEntry): Promise<void> {
    const identity =
      actor.kind === 'user'
        ? { userId: actor.id, userName: actor.name, userEmail: actor.email }
        : {
            userId: `system:${actor.id}`,
            userName: actor.name,
            userEmail: 'system',
          }

    await auditService
      .log({
        ...identity,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata ?? null,
        ip: actor.ip ?? null,
        userAgent: actor.userAgent ?? null,
      })
      .catch((err: unknown) =>
        logger.error(
          { err, action: entry.action, resource: entry.resource },
          'audit log failed'
        )
      )
  }

  return { record }
}

export type AuditRecorder = ReturnType<typeof createAuditRecorder>
