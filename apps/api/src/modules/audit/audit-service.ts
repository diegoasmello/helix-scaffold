import { desc, eq } from 'drizzle-orm'

import type { Database } from '@/db'
import { auditLogs } from '@/db/schema'

interface AuditLogInput {
  userId: string
  userName: string
  userEmail: string
  action: 'create' | 'edit' | 'delete'
  resource: string
  resourceId?: string | null
  metadata?: unknown
  ip?: string | null
  userAgent?: string | null
}

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

  async function list() {
    return database.select().from(auditLogs).orderBy(desc(auditLogs.createdAt))
  }

  async function getById(id: string) {
    const [item] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
    return item ?? null
  }

  return { log, list, getById }
}
