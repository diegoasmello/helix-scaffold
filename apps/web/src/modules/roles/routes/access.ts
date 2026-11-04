import type { PageAccess } from '@/modules/auth/page-access'

export const ROLES_ACCESS = {
  view: { permission: { resource: 'roles', action: 'view' } },
  create: { permission: { resource: 'roles', action: 'create' } },
  edit: { permission: { resource: 'roles', action: 'edit' } },
  /** The editor shows the role and its grants before saving new ones. */
  permissions: {
    permission: [
      { resource: 'roles', action: 'view' },
      { resource: 'permissions', action: 'view' },
      { resource: 'permissions', action: 'edit' },
    ],
  },
} satisfies Record<string, PageAccess>
