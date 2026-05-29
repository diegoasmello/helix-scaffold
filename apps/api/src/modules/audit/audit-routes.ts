import z from 'zod'

import { buildPaginatedResponse } from '@/lib/pagination'

import type { Database } from '../../db'
import type { FastifyTypedInstance, RequirePermission } from '../../types'
import {
  auditLogSchema,
  auditLogsExportQuerySchema,
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
    '/audit-logs/export',
    {
      schema: {
        tags: ['audit'],
        description: 'Export audit logs as PDF',
        querystring: auditLogsExportQuerySchema,
      },
      preHandler: requirePermission('audit', 'view'),
    },
    async (request, reply) => {
      let buffer: Buffer
      try {
        buffer = await service.generateReport(request.query)
      } catch {
        return reply.status(500).send({ message: 'Failed to generate report' })
      }
      const date = new Date().toISOString().split('T')[0]
      return reply
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `attachment; filename="audit-logs-${date}.pdf"`
        )
        .send(buffer)
    }
  )

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
