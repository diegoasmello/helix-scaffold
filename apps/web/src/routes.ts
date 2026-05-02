import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'

import { App } from './app'
import { queryClient } from './lib/query-client'
import { ErrorBoundary } from './modules/errors/error-boundary'
import { Forbidden } from './modules/errors/forbidden'
import { NotFound } from './modules/errors/not-found'

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

const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([forbiddenRoute]),
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
