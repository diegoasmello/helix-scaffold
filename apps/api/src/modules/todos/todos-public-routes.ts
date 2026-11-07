import z from 'zod'

import type { Database } from '@/db'
import { buildPaginatedResponse } from '@/lib/pagination'

import type { FastifyTypedInstance } from '../../types'
import {
  paginatedPublicTodosSchema,
  publicTodoSchema,
  publicTodosListQuerySchema,
} from './todos-public-schema'
import { createTodosPublicService } from './todos-public-service'

/**
 * What a site reads of todos without signing in: published todos only, with
 * the fields of `publicTodoSchema`. Registered in the public scope of `app.ts`
 * (`/api/public/*` — rate limit, public cache, no session), so no
 * `requirePermission` or `requireSubscription`: those decide who uses the
 * admin, not who visits the site.
 */
export async function todosPublicRoutes(
  app: FastifyTypedInstance,
  { database, baseUrl }: { database: Database; baseUrl: string }
) {
  const service = createTodosPublicService(database, baseUrl)

  app.get(
    '/todos',
    {
      schema: {
        operationId: 'getPublicTodos',
        tags: ['public'],
        description: 'List published todos — public, no session',
        querystring: publicTodosListQuerySchema,
        response: { 200: paginatedPublicTodosSchema },
      },
    },
    async (request) => {
      const { data, total } = await service.list(request.query)
      return buildPaginatedResponse(data, total, request.query)
    }
  )

  app.get(
    '/todos/:slug',
    {
      schema: {
        operationId: 'getPublicTodoBySlug',
        tags: ['public'],
        description:
          'Get a published todo by slug — public, no session; 404 for a draft',
        params: z.object({ slug: z.string().max(200) }),
        response: {
          200: publicTodoSchema,
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const todo = await service.getBySlug(request.params.slug)
      if (!todo) return reply.status(404).send({ message: 'Todo not found' })
      return todo
    }
  )
}
