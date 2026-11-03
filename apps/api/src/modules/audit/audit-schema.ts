import z from 'zod'

import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/lib/pagination'
import { sortingQuerySchema } from '@/lib/sorting'

export const auditLogSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    userName: z.string(),
    userEmail: z.string(),
    action: z.string(),
    resource: z.string(),
    resourceId: z.string().nullable(),
    metadata: z.unknown().nullable(),
    ip: z.string().nullable(),
    userAgent: z.string().nullable(),
    createdAt: z.date(),
  })
  .meta({ id: 'AuditLog', title: 'AuditLog' })

const AUDIT_LOG_SORT_COLUMNS = [
  'createdAt',
  'userName',
  'action',
  'resource',
] as const

const auditLogsSortingSchema = sortingQuerySchema([...AUDIT_LOG_SORT_COLUMNS])
export const auditLogsListQuerySchema = paginationQuerySchema.merge(
  auditLogsSortingSchema
)
export type AuditLogsListQuery = z.infer<typeof auditLogsListQuerySchema>

export const paginatedAuditLogsSchema = paginatedResponseSchema(
  auditLogSchema
).meta({
  id: 'PaginatedAuditLogs',
  title: 'PaginatedAuditLogs',
})

export const auditLogsExportQuerySchema = auditLogsSortingSchema
export type AuditLogsExportQuery = z.infer<typeof auditLogsExportQuerySchema>
