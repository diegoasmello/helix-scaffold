import z from 'zod'

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
