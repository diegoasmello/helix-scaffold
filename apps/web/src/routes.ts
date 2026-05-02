import { createRootRoute, createRouter, Outlet } from '@tanstack/react-router'

import { queryClient } from './lib/query-client'

export const rootRoute = createRootRoute({
  component: Outlet,
})

const routeTree = rootRoute.addChildren([])

export const router = createRouter({
  routeTree,
  context: { queryClient },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
