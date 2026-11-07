import type { PageAccess } from '@/modules/auth/page-access'

export const USERS_ACCESS = {
  view: { permission: { resource: 'users', action: 'view' } },
  create: { permission: { resource: 'users', action: 'create' } },
  edit: { permission: { resource: 'users', action: 'edit' } },
  // Admin only: the API never grants users:password to another role
  password: { permission: { resource: 'users', action: 'password' } },
} satisfies Record<string, PageAccess>
