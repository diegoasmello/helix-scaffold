import type { PageAccess } from '@/modules/auth/page-access'

/** The admin screens exist only while subscriptions are enabled. */
export const SUBSCRIPTIONS_ACCESS = {
  view: {
    permission: { resource: 'subscriptions', action: 'view' },
    requiresSubscriptions: true,
  },
  create: {
    permission: { resource: 'subscriptions', action: 'create' },
    requiresSubscriptions: true,
  },
  edit: {
    permission: { resource: 'subscriptions', action: 'edit' },
    requiresSubscriptions: true,
  },
} satisfies Record<string, PageAccess>
