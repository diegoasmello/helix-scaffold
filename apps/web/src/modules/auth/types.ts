import type { Grants, PermissionAction } from '@helix/api-client/types'

export type User = {
  id: string
  name: string
  email: string
  avatar?: string
  roleId: string | null
}

export type AuthState = {
  user: User | null
  grants: Grants
  isPending: boolean
  isAuthenticated: boolean
  hasPermission: (resource: string, action: PermissionAction) => boolean
}
