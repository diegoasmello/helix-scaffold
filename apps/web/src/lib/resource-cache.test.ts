import {
  getMeEntitlementsQueryKey,
  getMePermissionsQueryKey,
  getMeSubscriptionQueryKey,
  getRolesAllSuspenseQueryKey,
  getRolesIdPermissionsSuspenseQueryKey,
  getRolesIdSuspenseQueryKey,
  getRolesSuspenseQueryKey,
  getSubscriptionStatusQueryKey,
  getTodosIdSuspenseQueryKey,
  getTodosSuspenseQueryKey,
  getUsersAllSuspenseQueryKey,
  getUsersSuspenseQueryKey,
} from '@helix/api-client/hooks'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'

import { createResourceCache, detailQueryKey } from './resource-cache'

// Keys exactly as the generated hooks build them.
const keys = {
  rolesPage: getRolesSuspenseQueryKey({ page: 2, pageSize: 10 }),
  rolesAll: getRolesAllSuspenseQueryKey(),
  role1: getRolesIdSuspenseQueryKey('1'),
  role2: getRolesIdSuspenseQueryKey('2'),
  role1Permissions: getRolesIdPermissionsSuspenseQueryKey('1'),
  usersPage: getUsersSuspenseQueryKey(),
  usersAll: getUsersAllSuspenseQueryKey(),
  myPermissions: getMePermissionsQueryKey(),
  mySubscription: getMeSubscriptionQueryKey(),
  myEntitlements: getMeEntitlementsQueryKey(),
  subscriptionStatus: getSubscriptionStatusQueryKey(),
  todosPage: getTodosSuspenseQueryKey(),
  todo1: getTodosIdSuspenseQueryKey('1'),
}

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient()
  for (const key of Object.values(keys)) {
    queryClient.setQueryData(key, { cached: true })
  }
})

function invalidated() {
  return Object.entries(keys)
    .filter(([, key]) => queryClient.getQueryState(key)?.isInvalidated)
    .map(([name]) => name)
    .sort()
}

describe('detailQueryKey', () => {
  it('matches the generated detail keys', () => {
    expect(detailQueryKey('roles', '1')).toEqual(
      getRolesIdSuspenseQueryKey('1')
    )
    expect(detailQueryKey('todos', '1')).toEqual(
      getTodosIdSuspenseQueryKey('1')
    )
  })
})

describe('changed', () => {
  it('invalidates every query of the resource and the ones that show it', async () => {
    await createResourceCache(queryClient).changed('roles')
    expect(invalidated()).toEqual(
      [
        'rolesPage',
        'rolesAll',
        'role1',
        'role2',
        'role1Permissions',
        'usersPage',
        'usersAll',
        'myPermissions',
      ].sort()
    )
  })

  it('reaches the select-field list too (/users/all)', async () => {
    await createResourceCache(queryClient).changed('users')
    expect(invalidated()).toEqual(
      ['usersPage', 'usersAll', 'myPermissions'].sort()
    )
  })

  it("refreshes the admin's own subscription and entitlements", async () => {
    await createResourceCache(queryClient).changed('subscriptions')
    expect(invalidated()).toEqual(['myEntitlements', 'mySubscription'].sort())
  })

  it('leaves other resources alone', async () => {
    await createResourceCache(queryClient).changed('todos')
    expect(invalidated()).toEqual(['todo1', 'todosPage'])
  })
})

describe('saved', () => {
  it('seeds the detail with the response and refetches the rest', async () => {
    const updated = { id: '1', name: 'Renamed' }
    await createResourceCache(queryClient).saved('roles', updated)

    expect(queryClient.getQueryData(keys.role1)).toEqual(updated)
    expect(queryClient.getQueryState(keys.role1)?.isInvalidated).toBe(false)
    expect(invalidated()).toContain('rolesPage')
    expect(invalidated()).toContain('role2')
  })
})

describe('removed', () => {
  it('drops the detail and its sub-resources, and refetches the rest', async () => {
    await createResourceCache(queryClient).removed('roles', '1')

    expect(queryClient.getQueryState(keys.role1)).toBeUndefined()
    expect(queryClient.getQueryState(keys.role1Permissions)).toBeUndefined()
    expect(queryClient.getQueryState(keys.role2)).toBeDefined()
    expect(invalidated()).toEqual(
      [
        'rolesPage',
        'rolesAll',
        'role2',
        'usersPage',
        'usersAll',
        'myPermissions',
      ].sort()
    )
  })
})
