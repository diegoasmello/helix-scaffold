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

import type { PermissionResource, ResourceAction } from './config/permissions'
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

/**
 * Only pairs `RESOURCE_DEFINITIONS` declares compile — `('user', 'view')` and
 * `('audit', 'edit')` do not. An undeclared pair that slips past the types
 * (a cast) throws when the route registers.
 */
export type RequirePermission = <R extends PermissionResource>(
  resource: R,
  action: ResourceAction<R>
) => PreHandler

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
