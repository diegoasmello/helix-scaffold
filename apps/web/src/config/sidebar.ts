import type { PermissionAction } from '@helix/api-client/types'
import type { SidebarItem } from '@helix/ui'
import {
  IconChecklist,
  IconClipboardList,
  IconCreditCard,
  IconShield,
  IconUsers,
} from '@helix/ui'

interface SidebarItemWithPermission extends SidebarItem {
  permission?: { resource: string; action: PermissionAction }
  requiresSubscriptionEnabled?: true
  /** Hidden unless the user's plan includes this feature (see `subscriptions.plans` in the API config). */
  subscriptionFeature?: string
}

interface SidebarGroupWithPermission {
  titleKey?: string
  items: SidebarItemWithPermission[]
}

export const sidebarGroups: SidebarGroupWithPermission[] = [
  {
    items: [
      {
        label: 'nav.todos',
        icon: IconChecklist,
        to: '/todos',
        permission: { resource: 'todos', action: 'view' },
        subscriptionFeature: 'todos',
      },
    ],
  },
  {
    titleKey: 'nav.settings',
    items: [
      {
        label: 'nav.users',
        icon: IconUsers,
        to: '/users',
        permission: { resource: 'users', action: 'view' },
      },
      {
        label: 'nav.roles',
        icon: IconShield,
        to: '/roles',
        permission: { resource: 'roles', action: 'view' },
      },
      {
        label: 'nav.auditLog',
        icon: IconClipboardList,
        to: '/audit',
        permission: { resource: 'audit', action: 'view' },
      },
      {
        label: 'nav.subscriptions',
        icon: IconCreditCard,
        to: '/subscriptions',
        permission: { resource: 'subscriptions', action: 'view' },
        requiresSubscriptionEnabled: true,
      },
    ],
  },
]
