import { describe, expect, it } from 'vitest'

import {
  canSeeSidebarItem,
  findHomeSidebarItem,
  type SidebarAccess,
} from './sidebar'

function access(
  grants: Record<string, string[]>,
  overrides: Partial<SidebarAccess> = {}
): SidebarAccess {
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
      findHomeSidebarItem(access({ todos: ['view'], users: ['view'] }))?.to
    ).toBe('/todos')
  })

  it('skips items the user has no permission for', () => {
    expect(findHomeSidebarItem(access({ roles: ['view'] }))?.to).toBe('/roles')
  })

  it('skips items whose plan feature the user lacks', () => {
    const home = findHomeSidebarItem(
      access(
        { todos: ['view'], audit: ['view'] },
        { hasSubscriptionAccess: (feature) => feature !== 'todos' }
      )
    )
    expect(home?.to).toBe('/audit')
  })

  it('returns undefined when the user can open nothing', () => {
    expect(findHomeSidebarItem(access({}))).toBeUndefined()
  })
})

describe('canSeeSidebarItem', () => {
  const subscriptionsItem = {
    label: 'nav.subscriptions',
    icon: () => null,
    to: '/subscriptions' as const,
    permission: { resource: 'subscriptions', action: 'view' as const },
    requiresSubscriptionEnabled: true as const,
  }

  it('hides an item that requires subscriptions while they are disabled', () => {
    expect(
      canSeeSidebarItem(subscriptionsItem, access({ subscriptions: ['view'] }))
    ).toBe(false)
  })

  it('shows it once subscriptions are enabled', () => {
    expect(
      canSeeSidebarItem(
        subscriptionsItem,
        access({ subscriptions: ['view'] }, { subscriptionEnabled: true })
      )
    ).toBe(true)
  })
})
