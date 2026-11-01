import { describe, expect, it } from 'vitest'

import type { AccessCheckers } from '@/modules/auth/page-access'
import { SUBSCRIPTIONS_ACCESS } from '@/modules/subscriptions/routes/access'

import { canSeeSidebarItem, findHomeSidebarItem } from './sidebar'

function checkers(
  grants: Record<string, string[]>,
  overrides: Partial<AccessCheckers> = {}
): AccessCheckers {
  return {
    hasPermission: (resource, action) =>
      (grants[resource] ?? []).includes(action),
    hasSubscriptionAccess: () => true,
    subscriptionEnabled: false,
    ...overrides,
  }
}

describe('findHomeSidebarItem', () => {
  it('returns the first item the user may open, in sidebar order', () => {
    expect(
      findHomeSidebarItem(checkers({ todos: ['view'], users: ['view'] }))?.to
    ).toBe('/todos')
  })

  it('skips items the user has no permission for', () => {
    expect(findHomeSidebarItem(checkers({ roles: ['view'] }))?.to).toBe(
      '/roles'
    )
  })

  it('skips items whose plan feature the user lacks', () => {
    const home = findHomeSidebarItem(
      checkers(
        { todos: ['view'], audit: ['view'] },
        { hasSubscriptionAccess: (feature) => feature !== 'todos' }
      )
    )
    expect(home?.to).toBe('/audit')
  })

  it('returns undefined when the user can open nothing', () => {
    expect(findHomeSidebarItem(checkers({}))).toBeUndefined()
  })
})

describe('canSeeSidebarItem', () => {
  const subscriptionsItem = {
    label: 'nav.subscriptions',
    icon: () => null,
    to: '/subscriptions' as const,
    access: SUBSCRIPTIONS_ACCESS.view,
  }

  it('hides an item that requires subscriptions while they are disabled', () => {
    expect(
      canSeeSidebarItem(
        subscriptionsItem,
        checkers({ subscriptions: ['view'] })
      )
    ).toBe(false)
  })

  it('shows it once subscriptions are enabled', () => {
    expect(
      canSeeSidebarItem(
        subscriptionsItem,
        checkers({ subscriptions: ['view'] }, { subscriptionEnabled: true })
      )
    ).toBe(true)
  })

  it('shows an item without access to every signed-in user', () => {
    expect(
      canSeeSidebarItem(
        { label: 'nav.profile', icon: () => null, to: '/me' as const },
        checkers({})
      )
    ).toBe(true)
  })
})
