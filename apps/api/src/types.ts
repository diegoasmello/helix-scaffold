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

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: {
      id: string
      name: string
      email: string
      roleId: string | null
    }
    audit: (
      action: 'create' | 'edit' | 'delete' | 'export',
      resource: string,
      resourceId?: string | null,
      metadata?: unknown
    ) => Promise<void>
  }
}
