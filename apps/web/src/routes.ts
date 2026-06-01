import { getMePermissionsQueryOptions } from '@helix/api-client/hooks'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import { App } from './app'
import { authClient } from './lib/authentication'
import { queryClient } from './lib/query-client'
import { auditRoutes } from './modules/audit/routes'
import { AuthGuard } from './modules/auth/components/auth-guard'
import { authRoutes } from './modules/auth/routes'
import { ErrorBoundary } from './modules/errors/error-boundary'
import { Forbidden } from './modules/errors/forbidden'
import { NotFound } from './modules/errors/not-found'
import { meRoutes } from './modules/me/routes'
import { rolesRoutes } from './modules/roles/routes'
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

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/todos', search: { page: 1, pageSize: 10 } })
  },
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

    const perms = await (
      context as { queryClient: typeof queryClient }
    ).queryClient.ensureQueryData(getMePermissionsQueryOptions())
    const grants = perms?.grants ?? {}

    return {
      hasPermission: (resource: string, action: string): boolean =>
        (grants[resource] ?? []).includes(action),
    }
  },
})

const routeTree = rootRoute.addChildren([
  ...authRoutes,
  layoutRoute.addChildren([
    indexRoute,
    forbiddenRoute,
    authenticatedRoute.addChildren([
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
