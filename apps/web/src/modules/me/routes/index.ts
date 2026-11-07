import { getMeSuspenseQueryOptions } from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'

import { registrationStatusQueryOptions } from '@/modules/auth/use-registration-open'
import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import { MeAccount } from './me-account'
import { MePage } from './me-page'
import { MePending } from './me-pending'
import { MePreferences } from './me-preferences'
import { MeSecurity } from './me-security'
import { MeSubscription } from './me-subscription'

const meRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/me',
  component: MePage,
  pendingComponent: MePending,
  staticData: {
    breadcrumbs: [{ label: 'nav.profile' }],
  },
  loader: () =>
    Promise.all([
      queryClient.ensureQueryData(getMeSuspenseQueryOptions()),
      // `/me/account` offers the email change only when the API sends email
      queryClient.ensureQueryData(registrationStatusQueryOptions()),
    ]),
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

const mePreferencesRoute = createRoute({
  getParentRoute: () => meRoute,
  path: '/preferences',
  component: MePreferences,
})

const meSubscriptionRoute = createRoute({
  getParentRoute: () => meRoute,
  path: '/subscription',
  component: MeSubscription,
  beforeLoad: ({ context }) => {
    if (!context.subscriptionEnabled) throw redirect({ to: '/me/account' })
  },
})

export const meRoutes = [
  meRoute.addChildren([
    meIndexRoute,
    meAccountRoute,
    meSecurityRoute,
    mePreferencesRoute,
    meSubscriptionRoute,
  ]),
]
