import { getMeSuspenseQueryOptions } from '@helix/api-client/hooks'
import { createRoute } from '@tanstack/react-router'

import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import { MePage } from './me-page'
import { MePending } from './me-pending'

export const meRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/me',
  component: MePage,
  pendingComponent: MePending,
  staticData: {
    breadcrumbs: [{ label: 'Profile' }],
  },
  loader: () => queryClient.ensureQueryData(getMeSuspenseQueryOptions()),
})

export const meRoutes = [meRoute]
