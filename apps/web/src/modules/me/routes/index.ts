import {
  getMeSuspenseQueryOptions,
  getSubscriptionStatusQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'

import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import { MeAccount } from './me-account'
import { MePage } from './me-page'
import { MePending } from './me-pending'
import { MePreferences } from './me-preferences'
import { MeSecurity } from './me-security'
import { MeSignIn } from './me-sign-in'
import { MeSubscription } from './me-subscription'

const meRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/me',
  component: MePage,
  pendingComponent: MePending,
  staticData: {
    breadcrumbs: [{ label: 'nav.profile' }],
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

const meSignInRoute = createRoute({
  getParentRoute: () => meRoute,
  path: '/sign-in',
  component: MeSignIn,
})

const meSecurityRoute = createRoute({
  getParentRoute: () => meRoute,
  path: '/security',
  component: MeSecurity,
})

const mePreferencesRoute = createRoute({
  getParentRoute: () => meRoute,
  path: '/preferences',
  component: MePreferences,
})

const meSubscriptionRoute = createRoute({
  getParentRoute: () => meRoute,
  path: '/subscription',
  component: MeSubscription,
  beforeLoad: async () => {
    const { enabled } = await queryClient.ensureQueryData(
      getSubscriptionStatusQueryOptions()
    )
    if (!enabled) throw redirect({ to: '/me/account' })
  },
})

export const meRoutes = [
  meRoute.addChildren([
    meIndexRoute,
    meAccountRoute,
    meSignInRoute,
    meSecurityRoute,
    mePreferencesRoute,
    meSubscriptionRoute,
  ]),
]
