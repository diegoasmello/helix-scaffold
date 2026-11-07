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

/**
 * How long `GET /me/permissions` stays fresh — shared by every reader of that
 * cache (here and the permission editor), so none refetches it on mount.
 */
export const ME_PERMISSIONS_STALE_TIME = 30_000

export function useAuth(): AuthState {
  const { data: session, isPending: sessionPending } = authClient.useSession()

  // The profile: the current name (kept fresh by `/me/account`'s mutations)
  // and the role's name for the header's user menu.
  const { data: meData } = useQuery({
    queryKey: getMeSuspenseQueryKey(),
    queryFn: async () => getMeSuspense(),
    enabled: !!session?.user,
    staleTime: Infinity,
  })

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        name: meData?.name ?? session.user.name,
        email: meData?.email ?? session.user.email,
        avatar: session.user.image ?? undefined,
        roleId: (session.user as { roleId?: string | null }).roleId ?? null,
        roleName: meData?.role?.name ?? null,
      }
    : null

  const { data: permissionsData, isPending: permsPending } = useQuery({
    queryKey: getMePermissionsQueryKey(),
    queryFn: () => getMePermissions(),
    enabled: !!user,
    staleTime: ME_PERMISSIONS_STALE_TIME,
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
