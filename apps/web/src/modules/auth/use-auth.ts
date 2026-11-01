import {
  getMePermissions,
  getMePermissionsQueryKey,
  getMeSuspense,
  getMeSuspenseQueryKey,
} from '@helix/api-client/hooks'
import { useQuery } from '@tanstack/react-query'

import { authClient } from '../../lib/authentication'
import { createPermissionChecker } from './page-access'
import type { AuthState, User } from './types'

export function useAuth(): AuthState {
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const { data: meData } = useQuery({
    queryKey: getMeSuspenseQueryKey(),
    queryFn: async () => getMeSuspense(),
    enabled: false,
    staleTime: Infinity,
  })

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        name: meData?.name ?? session.user.name,
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
  const hasPermission = createPermissionChecker(grants)

  return {
    user,
    grants,
    isPending: sessionPending || (!!user && permsPending),
    isAuthenticated: !!user,
    hasPermission,
  }
}
