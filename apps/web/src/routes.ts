import {
  getMeEntitlementsQueryOptions,
  getMePermissionsQueryOptions,
  getSubscriptionStatusQueryOptions,
} from '@helix/api-client/hooks'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import { App } from './app'
import { findHomeSidebarItem } from './config/sidebar'
import { authClient } from './lib/authentication'
import { queryClient } from './lib/query-client'
import { auditRoutes } from './modules/audit/routes'
import { AuthGuard } from './modules/auth/components/auth-guard'
import {
  type AccessCheckers,
  createPermissionChecker,
} from './modules/auth/page-access'
import { authRoutes } from './modules/auth/routes'
import { ErrorBoundary } from './modules/errors/error-boundary'
import { Forbidden } from './modules/errors/forbidden'
import { NotFound } from './modules/errors/not-found'
import { meRoutes } from './modules/me/routes'
import { rolesRoutes } from './modules/roles/routes'
import { hasSubscriptionAccess } from './modules/subscriptions/access'
import { subscriptionsRoutes } from './modules/subscriptions/routes'
import { todosRoutes } from './modules/todos/routes'
import { usersRoutes } from './modules/users/routes'

export const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
})

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: App,
})

const forbiddenRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/403',
  component: Forbidden,
})

export const authenticatedRoute = createRoute({
  getParentRoute: () => layoutRoute,
  id: 'authenticated',
  component: AuthGuard,
  beforeLoad: async ({ context }) => {
    const session = await authClient.getSession()
    if (!session.data?.user) throw redirect({ to: '/login' })

    const client = (context as { queryClient: typeof queryClient }).queryClient
    const perms = await client.ensureQueryData(getMePermissionsQueryOptions())
    const hasPermission = createPermissionChecker(perms?.grants ?? {})

    // Same queries (and cache) as useSubscriptionAccess(), so this adds no requests.
    const status = await client.ensureQueryData(
      getSubscriptionStatusQueryOptions()
    )
    const subscriptionAccess = {
      enabled: status.enabled,
      entitlements: status.enabled
        ? await client.ensureQueryData(getMeEntitlementsQueryOptions())
        : null,
    }

    const checkers: AccessCheckers = {
      hasPermission,
      /** Route guard counterpart of `<RequiresSubscription feature>`. */
      hasSubscriptionAccess: (feature?: string): boolean =>
        hasSubscriptionAccess(subscriptionAccess, feature),
      subscriptionEnabled: status.enabled,
    }
    // What every child route's `guardPage()` reads.
    return checkers
  },
})

// `/` lands on the first sidebar page the user may open — `/me` (always
// allowed) when there is none, e.g. a self-registered user whose default role
// has no permissions yet.
const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    const home = findHomeSidebarItem(context)
    throw redirect({ to: home?.to ?? home?.links?.[0]?.to ?? '/me' })
  },
})

const routeTree = rootRoute.addChildren([
  ...authRoutes,
  layoutRoute.addChildren([
    forbiddenRoute,
    authenticatedRoute.addChildren([
      indexRoute,
      ...usersRoutes,
      ...rolesRoutes,
      ...auditRoutes,
      ...meRoutes,
      ...todosRoutes,
      ...subscriptionsRoutes,
    ]),
  ]),
])

export const router = createRouter({
  routeTree,
  context: { queryClient },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
