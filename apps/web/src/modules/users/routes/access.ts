import type { PageAccess } from '@/modules/auth/page-access'

export const USERS_ACCESS = {
  view: { permission: { resource: 'users', action: 'view' } },
  create: { permission: { resource: 'users', action: 'create' } },
  edit: { permission: { resource: 'users', action: 'edit' } },
} satisfies Record<string, PageAccess>
