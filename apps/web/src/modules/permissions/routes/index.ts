import {
  getPermissionsResourcesSuspenseQueryOptions,
  getRolesSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'

import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import { Permissions } from './permissions'
import { PermissionsPending } from './permissions-pending'

const permissionsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/permissions',
  component: Permissions,
  pendingComponent: PermissionsPending,
  staticData: {
    breadcrumbs: [{ label: 'Permissions' }],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('permissions', 'view'))
      throw redirect({ to: '/403' })
  },
  loader: () => {
    queryClient.ensureQueryData(getPermissionsResourcesSuspenseQueryOptions())
    return queryClient.ensureQueryData(getRolesSuspenseQueryOptions())
  },
})

export const permissionsRoutes = [permissionsRoute]
