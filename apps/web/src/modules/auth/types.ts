import type {
  Grants,
  PermissionAction,
  PermissionResource,
} from '@helix/api-client/types'

export type User = {
  id: string
  name: string
  email: string
  avatar?: string
  roleId: string | null
  /** From `GET /me` — `null` until it loads, or without a role. */
  roleName: string | null
}

export type AuthState = {
  user: User | null
  grants: Grants
  isPending: boolean
  isAuthenticated: boolean
  hasPermission: (
    resource: PermissionResource,
    action: PermissionAction
  ) => boolean
}
