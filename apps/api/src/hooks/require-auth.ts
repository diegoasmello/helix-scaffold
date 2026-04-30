import { fromNodeHeaders } from 'better-auth/node'
import type { FastifyReply, FastifyRequest } from 'fastify'

import type { Auth } from '@/auth'

export function createRequireAuth(auth: Auth) {
  return async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    })

    if (!session) {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    request.sessionUser = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      roleId: session.user.roleId ?? null,
    }
  }
}
