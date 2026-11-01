import type { Grants, PermissionAction } from '@helix/api-client/types'
import { redirect } from '@tanstack/react-router'

/**
 * What a page requires. Declared once per page (in the module's
 * `routes/access.ts`) and read by both its route guard (`guardPage`) and,
 * for pages in the sidebar, the sidebar item — so the two can never disagree.
 */
export interface PageAccess {
  /** RBAC permission (`src/config/permissions.ts` in the API). Missing → `/403`. */
  permission?: { resource: string; action: PermissionAction }
  /** Plan feature (`subscriptions.plans` in the API config). Missing → `/upgrade?feature=…`. */
  feature?: string
  /** The page only exists while subscriptions are enabled. Off → `/`. */
  requiresSubscriptions?: true
}

/** What the router context (`authenticatedRoute.beforeLoad`) and `App` provide. */
export interface AccessCheckers {
  hasPermission: (resource: string, action: PermissionAction) => boolean
  hasSubscriptionAccess: (feature?: string) => boolean
  subscriptionEnabled: boolean
}

export type PageAccessResult =
  | { allowed: true }
  | { allowed: false; redirectTo: '/' }
  | { allowed: false; redirectTo: '/upgrade'; feature: string }
  | { allowed: false; redirectTo: '/403' }

/**
 * The decision, in the API's order: a page that does not exist (subscriptions
 * off), then the plan, then the permission.
 */
export function checkPageAccess(
  access: PageAccess,
  checkers: AccessCheckers
): PageAccessResult {
  if (access.requiresSubscriptions && !checkers.subscriptionEnabled) {
    return { allowed: false, redirectTo: '/' }
  }
  if (access.feature && !checkers.hasSubscriptionAccess(access.feature)) {
    return { allowed: false, redirectTo: '/upgrade', feature: access.feature }
  }
  if (
    access.permission &&
    !checkers.hasPermission(
      access.permission.resource,
      access.permission.action
    )
  ) {
    return { allowed: false, redirectTo: '/403' }
  }
  return { allowed: true }
}

/** A `beforeLoad` that also says which `PageAccess` it enforces. */
export type PageGuard = ((options: { context: AccessCheckers }) => void) & {
  readonly access: PageAccess
}

/**
 * The route guard for a page: `beforeLoad: guardPage(TODOS_ACCESS.list)`.
 * Redirects as `checkPageAccess` decides. The returned function carries its
 * `access`, so tests can check that a sidebar item and its route agree.
 */
export function guardPage(access: PageAccess): PageGuard {
  const guard = ({ context }: { context: AccessCheckers }) => {
    const result = checkPageAccess(access, context)
    if (result.allowed) return
    if (result.redirectTo === '/upgrade') {
      throw redirect({ to: '/upgrade', search: { feature: result.feature } })
    }
    throw redirect({ to: result.redirectTo })
  }
  return Object.assign(guard, { access })
}

/** `hasPermission` over the grants of `GET /me/permissions` — shared by `useAuth()` and the router context. */
export function createPermissionChecker(grants: Grants) {
  return (resource: string, action: PermissionAction): boolean =>
    grants[resource]?.includes(action) ?? false
}
