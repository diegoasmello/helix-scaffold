import type { PageAccess } from '@/modules/auth/page-access'

export const ROLES_ACCESS = {
  view: { permission: { resource: 'roles', action: 'view' } },
  create: { permission: { resource: 'roles', action: 'create' } },
  edit: { permission: { resource: 'roles', action: 'edit' } },
  permissions: { permission: { resource: 'permissions', action: 'edit' } },
} satisfies Record<string, PageAccess>
