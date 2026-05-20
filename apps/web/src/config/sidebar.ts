import type { PermissionAction } from '@helix/api-client/types'
import type { SidebarItem } from '@helix/ui'
import {
  IconChecklist,
  IconClipboardList,
  IconLock,
  IconShield,
  IconUsers,
} from '@helix/ui'

interface SidebarItemWithPermission extends SidebarItem {
  permission?: { resource: string; action: PermissionAction }
}

interface SidebarGroupWithPermission {
  title?: string
  items: SidebarItemWithPermission[]
}

export const sidebarGroups: SidebarGroupWithPermission[] = [
  {
    items: [
      {
        label: 'Todos',
        icon: IconChecklist,
        to: '/todos',
        permission: { resource: 'todos', action: 'view' },
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        label: 'Users',
        icon: IconUsers,
        to: '/users',
        permission: { resource: 'users', action: 'view' },
      },
      {
        label: 'Roles',
        icon: IconShield,
        to: '/roles',
        permission: { resource: 'roles', action: 'view' },
      },
      {
        label: 'Permissions',
        icon: IconLock,
        to: '/permissions',
        permission: { resource: 'permissions', action: 'view' },
      },
      {
        label: 'Audit Log',
        icon: IconClipboardList,
        to: '/audit',
        permission: { resource: 'audit', action: 'view' },
      },
    ],
  },
]
