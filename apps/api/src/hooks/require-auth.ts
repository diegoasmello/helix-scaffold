import { fromNodeHeaders } from 'better-auth/node'
import type { FastifyReply, FastifyRequest } from 'fastify'

import type { Auth } from '@/auth'

type SessionUser = FastifyRequest['sessionUser']

/**
 * The signed-in user of the request's session cookie, or `null`. For a route
 * outside the `authenticated` scope that answers anonymous requests too
 * (`GET /files/*` serves published files to anyone); everything else uses
 * `requireAuth`.
 */
export async function readSessionUser(
  auth: Auth,
  request: FastifyRequest
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  })
  if (!session) return null
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roleId: session.user.roleId ?? null,
  }
}

export function createRequireAuth(auth: Auth) {
  return async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const sessionUser = await readSessionUser(auth, request)

    if (!sessionUser) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    request.sessionUser = sessionUser
  }
}
