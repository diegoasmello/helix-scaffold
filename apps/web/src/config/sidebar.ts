import type { PermissionAction } from '@helix/api-client/types'
import type { SidebarItem } from '@helix/ui'

interface SidebarItemWithPermission extends SidebarItem {
  permission?: { resource: string; action: PermissionAction }
}

export const sidebarItems: SidebarItemWithPermission[] = []
