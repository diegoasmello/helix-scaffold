import type { PageAccess } from '@/modules/auth/page-access'

export const AUDIT_ACCESS = {
  view: { permission: { resource: 'audit', action: 'view' } },
} satisfies Record<string, PageAccess>
