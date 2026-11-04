import type { ResourceDefinition } from '@helix/api-client/types'
import { describe, expect, it } from 'vitest'

import {
  cascadeOf,
  countChanges,
  dependentsOf,
  grantWithRequirements,
  isGrantable,
  missingRequirements,
  requirementsOf,
  revokeWithDependents,
  ungrantedActions,
} from './permission-requirements'

const definitions: ResourceDefinition[] = [
  {
    resource: 'roles',
    label: 'Roles',
    actions: ['view', 'edit'],
    requires: { edit: [{ resource: 'roles', action: 'view' }] },
  },
  {
    resource: 'users',
    label: 'Users',
    actions: ['view', 'edit'],
    requires: {
      edit: [
        { resource: 'users', action: 'view' },
        { resource: 'roles', action: 'view' },
      ],
    },
  },
  {
    resource: 'permissions',
    label: 'Permissions',
    actions: ['view', 'edit'],
    requires: {
      view: [{ resource: 'roles', action: 'view' }],
      edit: [{ resource: 'permissions', action: 'view' }],
    },
  },
  { resource: 'audit', label: 'Audit', actions: ['view'], requires: {} },
]

describe('requirementsOf', () => {
  it('follows the chain of requirements', () => {
    expect(requirementsOf(definitions, 'permissions', 'edit')).toEqual([
      { resource: 'permissions', action: 'view' },
      { resource: 'roles', action: 'view' },
    ])
  })

  it('keeps the order the catalog declares', () => {
    expect(requirementsOf(definitions, 'users', 'edit')).toEqual([
      { resource: 'users', action: 'view' },
      { resource: 'roles', action: 'view' },
    ])
  })

  it('is empty for an action without requirements', () => {
    expect(requirementsOf(definitions, 'audit', 'view')).toEqual([])
    expect(requirementsOf(definitions, 'roles', 'view')).toEqual([])
  })

  it('stops on a cycle', () => {
    const cyclic: ResourceDefinition[] = [
      {
        resource: 'roles',
        label: 'Roles',
        actions: ['view', 'edit'],
        requires: {
          view: [{ resource: 'roles', action: 'edit' }],
          edit: [{ resource: 'roles', action: 'view' }],
        },
      },
    ]
    expect(requirementsOf(cyclic, 'roles', 'edit')).toEqual([
      { resource: 'roles', action: 'view' },
    ])
  })
})

describe('grantWithRequirements', () => {
  it('adds the actions and what they require, keeping the rest', () => {
    expect(
      grantWithRequirements({ audit: ['view'] }, definitions, 'permissions', [
        'edit',
      ])
    ).toEqual({
      audit: ['view'],
      permissions: ['edit', 'view'],
      roles: ['view'],
    })
  })

  it('does not duplicate what is already held', () => {
    expect(
      grantWithRequirements(
        { roles: ['view'], permissions: ['view'] },
        definitions,
        'permissions',
        ['edit']
      )
    ).toEqual({ roles: ['view'], permissions: ['view', 'edit'] })
  })
})

describe('revokeWithDependents', () => {
  it('removes the actions and everything that needs them', () => {
    expect(
      revokeWithDependents(
        {
          roles: ['view', 'edit'],
          permissions: ['view', 'edit'],
          audit: ['view'],
        },
        definitions,
        'roles',
        ['view']
      )
    ).toEqual({ roles: [], permissions: [], audit: ['view'] })
  })

  it('leaves what does not depend on them', () => {
    expect(
      revokeWithDependents(
        { roles: ['view', 'edit'], permissions: ['view', 'edit'] },
        definitions,
        'permissions',
        ['view']
      )
    ).toEqual({ roles: ['view', 'edit'], permissions: [] })
  })
})

describe('dependentsOf', () => {
  it('lists what needs the permission, transitively, in catalog order', () => {
    expect(dependentsOf(definitions, 'roles', 'view')).toEqual([
      { resource: 'roles', action: 'edit' },
      { resource: 'users', action: 'edit' },
      { resource: 'permissions', action: 'view' },
      { resource: 'permissions', action: 'edit' },
    ])
  })

  it('is empty when nothing needs it', () => {
    expect(dependentsOf(definitions, 'audit', 'view')).toEqual([])
    expect(dependentsOf(definitions, 'permissions', 'edit')).toEqual([])
  })
})

describe('isGrantable', () => {
  const holding =
    (grants: Record<string, string[]>) => (resource: string, action: string) =>
      grants[resource]?.includes(action) ?? false

  it('needs the permission and everything it requires', () => {
    const canGrant = holding({ permissions: ['view', 'edit'] })
    // permissions:edit → permissions:view → roles:view, which the user lacks
    expect(isGrantable(definitions, canGrant, 'permissions', 'edit')).toBe(
      false
    )
    expect(
      isGrantable(
        definitions,
        holding({ roles: ['view'], permissions: ['view', 'edit'] }),
        'permissions',
        'edit'
      )
    ).toBe(true)
  })

  it('refuses a permission the user lacks', () => {
    expect(isGrantable(definitions, holding({}), 'audit', 'view')).toBe(false)
  })
})

describe('missingRequirements', () => {
  it('lists the requirements not held, transitively, with what needs them', () => {
    expect(
      missingRequirements(
        { users: ['edit'], permissions: ['edit'] },
        definitions
      )
    ).toEqual([
      {
        permission: { resource: 'roles', action: 'view' },
        neededBy: [
          { resource: 'users', action: 'edit' },
          { resource: 'permissions', action: 'edit' },
        ],
      },
      {
        permission: { resource: 'users', action: 'view' },
        neededBy: [{ resource: 'users', action: 'edit' }],
      },
      {
        permission: { resource: 'permissions', action: 'view' },
        neededBy: [{ resource: 'permissions', action: 'edit' }],
      },
    ])
  })

  it('is empty when every requirement is held', () => {
    expect(
      missingRequirements(
        { roles: ['view', 'edit'], permissions: ['view'] },
        definitions
      )
    ).toEqual([])
  })
})

describe('cascadeOf', () => {
  it('lists what was checked besides the clicked actions', () => {
    expect(
      cascadeOf(
        {},
        { permissions: ['edit', 'view'], roles: ['view'] },
        definitions,
        { resource: 'permissions', actions: ['edit'] }
      )
    ).toEqual({
      granted: [
        { resource: 'roles', action: 'view' },
        { resource: 'permissions', action: 'view' },
      ],
      revoked: [],
    })
  })

  it('lists what was unchecked besides the clicked actions', () => {
    expect(
      cascadeOf(
        { roles: ['view', 'edit'], audit: ['view'] },
        { roles: [], audit: ['view'] },
        definitions,
        { resource: 'roles', actions: ['view'] }
      )
    ).toEqual({ granted: [], revoked: [{ resource: 'roles', action: 'edit' }] })
  })
})

describe('countChanges', () => {
  it('counts the pairs checked or unchecked on either side', () => {
    expect(
      countChanges(
        { roles: ['view', 'edit'], audit: ['view'] },
        { roles: ['view'], audit: ['view'], users: ['view'] }
      )
    ).toBe(2)
  })

  it('ignores order and empty resources', () => {
    expect(
      countChanges(
        { roles: ['view', 'edit'] },
        { roles: ['edit', 'view'], audit: [] }
      )
    ).toBe(0)
  })
})

describe('ungrantedActions', () => {
  it("lists the resource's actions not held that the user may grant", () => {
    // roles:edit needs roles:view, which the user may grant too
    const canGrant = (resource: string, action: string) =>
      resource === 'roles' || (resource === 'users' && action === 'edit')
    const [roles, users] = definitions
    expect(ungrantedActions({}, definitions, canGrant, roles)).toEqual([
      'view',
      'edit',
    ])
    expect(
      ungrantedActions({ roles: ['view'] }, definitions, canGrant, roles)
    ).toEqual(['edit'])
    // users:edit needs users:view, which the user may not grant
    expect(ungrantedActions({}, definitions, canGrant, users)).toEqual([])
  })
})
