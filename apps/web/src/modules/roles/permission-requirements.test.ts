import type { ResourceDefinition } from '@helix/api-client/types'
import { describe, expect, it } from 'vitest'

import {
  grantWithRequirements,
  requirementsOf,
  revokeWithDependents,
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
