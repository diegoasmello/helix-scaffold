import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import type { AuditAction, AuditResource } from './modules/audit/audit-recorder'

export type FastifyTypedInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>

export type PreHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>

export type RequirePermission = (resource: string, action: string) => PreHandler
/** Pass a feature to also require that the user's plan includes it. */
export type RequireSubscription = (feature?: string) => PreHandler

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: {
      id: string
      name: string
      email: string
      roleId: string | null
    }
    /** Best-effort: never throws. See `modules/audit/audit-recorder.ts`. */
    audit: (
      action: AuditAction,
      resource: AuditResource,
      resourceId?: string | null,
      metadata?: unknown
    ) => Promise<void>
  }
}
