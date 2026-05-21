import { getMeSuspenseQueryOptions } from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'

import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import { MeAccount } from './me-account'
import { MePage } from './me-page'
import { MePending } from './me-pending'
import { MeSecurity } from './me-security'

const meRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/me',
  component: MePage,
  pendingComponent: MePending,
  staticData: {
    breadcrumbs: [{ label: 'Profile' }],
  },
  loader: () => queryClient.ensureQueryData(getMeSuspenseQueryOptions()),
})

const meIndexRoute = createRoute({
  getParentRoute: () => meRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/me/account' })
  },
})

const meAccountRoute = createRoute({
  getParentRoute: () => meRoute,
  path: '/account',
  component: MeAccount,
})

const meSecurityRoute = createRoute({
  getParentRoute: () => meRoute,
  path: '/security',
  component: MeSecurity,
})

export const meRoutes = [
  meRoute.addChildren([meIndexRoute, meAccountRoute, meSecurityRoute]),
]
