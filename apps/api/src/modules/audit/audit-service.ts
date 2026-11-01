import { asc, count, desc, eq } from 'drizzle-orm'

import type { Database } from '@/db'
import { auditLogs } from '@/db/schema'
import { getPaginationParams } from '@/lib/pagination'

import type { AuditAction, AuditResource } from './audit-recorder'
import type { AuditLogsExportQuery, AuditLogsListQuery } from './audit-schema'

interface AuditLogInput {
  userId: string
  userName: string
  userEmail: string
  action: AuditAction
  resource: AuditResource
  resourceId?: string | null
  metadata?: unknown
  ip?: string | null
  userAgent?: string | null
}

const SORT_COLUMNS = {
  createdAt: auditLogs.createdAt,
  userName: auditLogs.userName,
  action: auditLogs.action,
  resource: auditLogs.resource,
} as const

export type AuditService = ReturnType<typeof createAuditService>

export function createAuditService(database: Database) {
  async function log(input: AuditLogInput): Promise<void> {
    await database.insert(auditLogs).values({
      userId: input.userId,
      userName: input.userName,
      userEmail: input.userEmail,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })
  }

  async function list(query: AuditLogsListQuery) {
    const { limit, offset } = getPaginationParams(query.page, query.pageSize)
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc
    const [data, [{ total }]] = await Promise.all([
      database
        .select()
        .from(auditLogs)
        .orderBy(sortFn(sortCol))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(auditLogs),
    ])
    return { data, total }
  }

  async function getById(id: string) {
    const [item] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
    return item ?? null
  }

  async function generateReport(query: AuditLogsExportQuery): Promise<Buffer> {
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc

    const data = await database
      .select()
      .from(auditLogs)
      .orderBy(sortFn(sortCol))
      .limit(5000)

    const { renderAuditReport } = await import('./templates/audit-report')
    return renderAuditReport(data)
  }

  return { log, list, getById, generateReport }
}
