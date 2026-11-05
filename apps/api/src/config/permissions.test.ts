import { describe, expect, it } from 'vitest'

import { config, overrideConfig } from '@/config'

import {
  dropUnmetRequirements,
  findRequirementsOnToggledResources,
  isResourceEnabled,
} from './permissions'

describe('isResourceEnabled', () => {
  const off = overrideConfig(config, { subscriptions: { enabled: false } })

  it('follows the setting of a toggled resource', () => {
    expect(isResourceEnabled('subscriptions', config)).toBe(true)
    expect(isResourceEnabled('subscriptions', off)).toBe(false)
  })

  it('answers true for any other name, prototype keys included', () => {
    for (const resource of ['users', 'unknown', 'toString', 'hasOwnProperty']) {
      expect(isResourceEnabled(resource, off)).toBe(true)
    }
  })
})

describe('findRequirementsOnToggledResources', () => {
  it('allows a resource to require its own pairs and always-on ones', () => {
    expect(
      findRequirementsOnToggledResources(
        {
          'subscriptions:create': ['subscriptions:view', 'users:view'],
          'users:edit': ['users:view'],
        },
        ['subscriptions']
      )
    ).toEqual([])
  })

  it('reports a requirement on a toggled resource from another one', () => {
    expect(
      findRequirementsOnToggledResources(
        { 'users:edit': ['users:view', 'subscriptions:view'] },
        ['subscriptions']
      )
    ).toEqual(['users:edit → subscriptions:view'])
  })
})

describe('dropUnmetRequirements', () => {
  it('keeps the grants whose requirements are still held', () => {
    expect(
      dropUnmetRequirements(
        { users: ['view'] },
        { subscriptions: ['view', 'create'] }
      )
    ).toEqual({ kept: { subscriptions: ['view', 'create'] }, dropped: {} })
  })

  it('drops a grant whose requirement is gone', () => {
    expect(
      dropUnmetRequirements({}, { subscriptions: ['view', 'create'] })
    ).toEqual({
      kept: { subscriptions: ['view'] },
      dropped: { subscriptions: ['create'] },
    })
  })

  it('drops what depended on a dropped grant, until none is left', () => {
    // permissions:edit → permissions:view → roles:view. Edit comes first, so
    // only a second pass sees it lose view.
    expect(
      dropUnmetRequirements({}, { permissions: ['edit', 'view'] })
    ).toEqual({ kept: {}, dropped: { permissions: ['view', 'edit'] } })
  })
})
