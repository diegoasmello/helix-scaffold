import z from 'zod'

import type { Database } from '../../db'
import type { FastifyTypedInstance, RequirePermission } from '../../types'
import { buildPaginatedResponse } from '@/lib/pagination'
import {
  auditLogSchema,
  auditLogsListQuerySchema,
  paginatedAuditLogsSchema,
} from './audit-schema'
import { createAuditService } from './audit-service'

export async function auditRoutes(
  app: FastifyTypedInstance,
  {
    database,
    requirePermission,
  }: { database: Database; requirePermission: RequirePermission }
) {
  const service = createAuditService(database)

  app.get(
    '/audit-logs',
    {
      schema: {
        tags: ['audit'],
        description: 'List audit log entries',
        querystring: auditLogsListQuerySchema,
        response: { 200: paginatedAuditLogsSchema },
      },
      preHandler: requirePermission('audit', 'view'),
    },
    async (request) => {
      const { data, total } = await service.list(request.query)
      return buildPaginatedResponse(data, total, request.query)
    }
  )

  app.get(
    '/audit-logs/:id',
    {
      schema: {
        tags: ['audit'],
        description: 'Get an audit log entry by id',
        params: z.object({ id: z.string() }),
        response: {
          200: auditLogSchema,
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('audit', 'view'),
    },
    async (request, reply) => {
      const item = await service.getById(request.params.id)
      if (!item)
        return reply.status(404).send({ message: 'Audit log not found' })
      return item
    }
  )
}
