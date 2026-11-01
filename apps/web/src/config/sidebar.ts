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

export interface SidebarAccess {
  hasPermission: (resource: string, action: PermissionAction) => boolean
  hasSubscriptionAccess: (feature: string) => boolean
  subscriptionEnabled: boolean
}

/**
 * Whether the signed-in user sees the item. Shared by the sidebar (`app.tsx`)
 * and the `/` redirect (`routes.ts`), so `/` always lands on a page the
 * sidebar offers.
 */
export function canSeeSidebarItem(
  item: SidebarItemWithPermission,
  access: SidebarAccess
): boolean {
  if (item.requiresSubscriptionEnabled && !access.subscriptionEnabled) {
    return false
  }
  if (
    item.subscriptionFeature &&
    !access.hasSubscriptionAccess(item.subscriptionFeature)
  ) {
    return false
  }
  return item.permission
    ? access.hasPermission(item.permission.resource, item.permission.action)
    : true
}

/** The first item the user can see, in sidebar order — the target of `/`. */
export function findHomeSidebarItem(
  access: SidebarAccess
): SidebarItemWithPermission | undefined {
  return sidebarGroups
    .flatMap((group) => group.items)
    .find((item) => canSeeSidebarItem(item, access))
}
