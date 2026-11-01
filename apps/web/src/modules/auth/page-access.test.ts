import { isRedirect } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import {
  type AccessCheckers,
  checkPageAccess,
  createPermissionChecker,
  guardPage,
  type PageAccess,
} from './page-access'

const todosList: PageAccess = {
  permission: { resource: 'todos', action: 'view' },
  feature: 'todos',
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
    expect(checkPageAccess(todosList, checkers())).toEqual({ allowed: true })
  })

  it('allows a page with no requirement', () => {
    expect(
      checkPageAccess({}, checkers({ hasPermission: () => false }))
    ).toEqual({ allowed: true })
  })

  it('sends to /403 without the permission', () => {
    expect(
      checkPageAccess(todosList, checkers({ hasPermission: () => false }))
    ).toEqual({ allowed: false, redirectTo: '/403' })
  })

  it('sends to /upgrade without the plan feature, before checking the permission', () => {
    expect(
      checkPageAccess(
        todosList,
        checkers({
          hasPermission: () => false,
          hasSubscriptionAccess: () => false,
        })
      )
    ).toEqual({ allowed: false, redirectTo: '/upgrade', feature: 'todos' })
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
    expect(rejection(todosList, checkers())).toBeUndefined()
  })

  it('throws a redirect to /403', () => {
    const error = rejection(todosList, checkers({ hasPermission: () => false }))
    expect(isRedirect(error)).toBe(true)
    expect((error as { options: { to: string } }).options.to).toBe('/403')
  })

  it('throws a redirect to /upgrade with the feature', () => {
    const error = rejection(
      todosList,
      checkers({ hasSubscriptionAccess: () => false })
    )
    expect(isRedirect(error)).toBe(true)
    expect(error).toMatchObject({
      options: { to: '/upgrade', search: { feature: 'todos' } },
    })
  })

  it('exposes the access it enforces', () => {
    expect(guardPage(todosList).access).toBe(todosList)
  })
})

describe('createPermissionChecker', () => {
  const hasPermission = createPermissionChecker({ todos: ['view', 'edit'] })

  it('checks resource and action against the grants', () => {
    expect(hasPermission('todos', 'edit')).toBe(true)
    expect(hasPermission('todos', 'delete')).toBe(false)
    expect(hasPermission('users', 'view')).toBe(false)
  })
})
