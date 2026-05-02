import {
  getMePermissions,
  getMePermissionsQueryKey,
} from '@helix/api-client/hooks'
import type { PermissionAction } from '@helix/api-client/types'
import { useQuery } from '@tanstack/react-query'

import { authClient } from '../../lib/authentication'
import type { AuthState, User } from './types'

export function useAuth(): AuthState {
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.image ?? undefined,
        roleId: (session.user as { roleId?: string | null }).roleId ?? null,
      }
    : null

  const { data: permissionsData, isPending: permsPending } = useQuery({
    queryKey: getMePermissionsQueryKey(),
    queryFn: () => getMePermissions(),
    enabled: !!user,
    staleTime: 30_000,
  })

  const grants = permissionsData?.grants ?? {}

  function hasPermission(resource: string, action: PermissionAction): boolean {
    return grants[resource]?.includes(action) ?? false
  }

  return {
    user,
    grants,
    isPending: sessionPending || (!!user && permsPending),
    isAuthenticated: !!user,
    hasPermission,
  }
}
