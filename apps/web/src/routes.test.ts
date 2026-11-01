import type { AnyRoute } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { sidebarGroups } from './config/sidebar'
import type { PageGuard } from './modules/auth/page-access'
import { authenticatedRoute, router } from './routes'

// Pages every signed-in user may open: no `guardPage()` expected.
const OPEN_TO_EVERY_USER = ['/', '/me', '/upgrade']

function guardOf(route: AnyRoute): PageGuard | undefined {
  const beforeLoad = route.options.beforeLoad as Partial<PageGuard> | undefined
  return beforeLoad?.access ? (beforeLoad as PageGuard) : undefined
}

function isUnder(route: AnyRoute, ancestor: AnyRoute): boolean {
  for (let parent = route.parentRoute; parent; parent = parent.parentRoute) {
    if (parent === ancestor) return true
  }
  return false
}

const authenticatedPages = (Object.values(router.routesById) as AnyRoute[])
  .filter((route) => isUnder(route, authenticatedRoute))
  // Pathless layout routes have no page of their own.
  .filter((route) => (route.options as { path?: string }).path !== undefined)

describe('route guards', () => {
  it.each(sidebarGroups.flatMap((group) => group.items))(
    'sidebar item $to uses the access its route enforces',
    (item) => {
      const route = (router.routesByPath as Record<string, AnyRoute>)[
        item.to ?? ''
      ]
      expect(route, `no route for ${item.to}`).toBeDefined()
      // The same object: the sidebar can only offer what the guard allows.
      expect(guardOf(route)?.access).toBe(item.access)
    }
  )

  it.each(
    authenticatedPages
      .map((route) => route.fullPath as string)
      .filter(
        (path) =>
          !OPEN_TO_EVERY_USER.some(
            (open) =>
              path === open || (open !== '/' && path.startsWith(`${open}/`))
          )
      )
  )('%s is protected by guardPage()', (path) => {
    const route = authenticatedPages.find((r) => r.fullPath === path)!
    expect(guardOf(route)).toBeDefined()
  })
})
