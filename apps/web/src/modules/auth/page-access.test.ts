import { isRedirect } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import {
  type AccessCheckers,
  checkPageAccess,
  createPermissionChecker,
  guardPage,
  hasPagePermission,
  type PageAccess,
} from './page-access'

// A page gated by a plan feature
const reports: PageAccess = {
  permission: { resource: 'audit', action: 'view' },
  feature: 'reports',
}
const adminOnly: PageAccess = {
  permission: { resource: 'subscriptions', action: 'view' },
  requiresSubscriptions: true,
}

function checkers(overrides: Partial<AccessCheckers> = {}): AccessCheckers {
  return {
    hasPermission: () => true,
    hasSubscriptionAccess: () => true,
    subscriptionEnabled: true,
    ...overrides,
  }
}

describe('checkPageAccess', () => {
  it('allows a page whose every requirement is met', () => {
    expect(checkPageAccess(reports, checkers())).toEqual({ allowed: true })
  })

  it('allows a page with no requirement', () => {
    expect(
      checkPageAccess({}, checkers({ hasPermission: () => false }))
    ).toEqual({ allowed: true })
  })

  it('sends to /403 without the permission', () => {
    expect(
      checkPageAccess(reports, checkers({ hasPermission: () => false }))
    ).toEqual({ allowed: false, redirectTo: '/403' })
  })

  it('sends to /upgrade without the plan feature, before checking the permission', () => {
    expect(
      checkPageAccess(
        reports,
        checkers({
          hasPermission: () => false,
          hasSubscriptionAccess: () => false,
        })
      )
    ).toEqual({ allowed: false, redirectTo: '/upgrade', feature: 'reports' })
  })

  it('sends to / when the page needs subscriptions and they are off', () => {
    expect(
      checkPageAccess(
        adminOnly,
        checkers({ subscriptionEnabled: false, hasPermission: () => false })
      )
    ).toEqual({ allowed: false, redirectTo: '/' })
  })
})

describe('hasPagePermission', () => {
  const editor: PageAccess = {
    permission: [
      { resource: 'permissions', action: 'view' },
      { resource: 'permissions', action: 'edit' },
    ],
  }

  it('needs every permission of a list', () => {
    const editOnly = createPermissionChecker({ permissions: ['edit'] })
    const both = createPermissionChecker({ permissions: ['view', 'edit'] })
    expect(hasPagePermission(editor, editOnly)).toBe(false)
    expect(hasPagePermission(editor, both)).toBe(true)
  })

  it('accepts a single permission, or none', () => {
    const hasPermission = createPermissionChecker({ audit: ['view'] })
    expect(hasPagePermission(reports, hasPermission)).toBe(true)
    expect(hasPagePermission({}, () => false)).toBe(true)
  })

  it('sends to /403 when one permission of the list is missing', () => {
    expect(
      checkPageAccess(
        editor,
        checkers({
          hasPermission: createPermissionChecker({ permissions: ['edit'] }),
        })
      )
    ).toEqual({ allowed: false, redirectTo: '/403' })
  })
})

describe('guardPage', () => {
  function rejection(access: PageAccess, context: AccessCheckers) {
    try {
      guardPage(access)({ context })
    } catch (error) {
      return error
    }
    return undefined
  }

  it('lets the navigation through when allowed', () => {
    expect(rejection(reports, checkers())).toBeUndefined()
  })

  it('throws a redirect to /403', () => {
    const error = rejection(reports, checkers({ hasPermission: () => false }))
    expect(isRedirect(error)).toBe(true)
    expect((error as { options: { to: string } }).options.to).toBe('/403')
  })

  it('throws a redirect to /upgrade with the feature', () => {
    const error = rejection(
      reports,
      checkers({ hasSubscriptionAccess: () => false })
    )
    expect(isRedirect(error)).toBe(true)
    expect(error).toMatchObject({
      options: { to: '/upgrade', search: { feature: 'reports' } },
    })
  })

  it('exposes the access it enforces', () => {
    expect(guardPage(reports).access).toBe(reports)
  })
})

describe('createPermissionChecker', () => {
  const hasPermission = createPermissionChecker({ roles: ['view', 'edit'] })

  it('checks resource and action against the grants', () => {
    expect(hasPermission('roles', 'edit')).toBe(true)
    expect(hasPermission('roles', 'delete')).toBe(false)
    expect(hasPermission('users', 'view')).toBe(false)
  })
})
