import {
  getRolesSuspenseQueryOptions,
  getUsersIdSuspenseQueryOptions,
  getUsersSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'

import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import type { UserItem } from '../types'
import { UsersCreate } from './users-create'
import { UsersDetail } from './users-detail'
import { UsersEdit } from './users-edit'
import { UsersList } from './users-list'
import { UsersPending } from './users-pending'

export const usersListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users',
  component: UsersList,
  pendingComponent: UsersPending,
  staticData: {
    breadcrumbs: [{ label: 'Users' }],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('users', 'view')) throw redirect({ to: '/403' })
  },
  loader: () => {
    queryClient.ensureQueryData(getRolesSuspenseQueryOptions())
    return queryClient.ensureQueryData(getUsersSuspenseQueryOptions())
  },
})

export const usersCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users/create',
  component: UsersCreate,
  pendingComponent: UsersPending,
  staticData: {
    breadcrumbs: [{ label: 'Users', to: '/users' }, { label: 'Create' }],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('users', 'create'))
      throw redirect({ to: '/403' })
  },
  loader: () => {
    queryClient.ensureQueryData(getRolesSuspenseQueryOptions())
  },
})

export const usersDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users/$id',
  component: UsersDetail,
  pendingComponent: UsersPending,
  staticData: {
    breadcrumbs: [
      { label: 'Users', to: '/users' },
      { label: 'View' },
      (data) => ({ label: `#${(data as UserItem).id}` }),
    ],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('users', 'view')) throw redirect({ to: '/403' })
  },
  loader: ({ params }) => {
    queryClient.ensureQueryData(getRolesSuspenseQueryOptions())
    return queryClient.ensureQueryData(
      getUsersIdSuspenseQueryOptions(params.id)
    )
  },
})

export const usersEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users/$id/edit',
  component: UsersEdit,
  pendingComponent: UsersPending,
  staticData: {
    breadcrumbs: [
      { label: 'Users', to: '/users' },
      { label: 'Edit' },
      (data) => ({ label: `#${(data as UserItem).id}` }),
    ],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('users', 'edit')) throw redirect({ to: '/403' })
  },
  loader: ({ params }) => {
    queryClient.ensureQueryData(getRolesSuspenseQueryOptions())
    return queryClient.ensureQueryData(
      getUsersIdSuspenseQueryOptions(params.id)
    )
  },
})

export const usersRoutes = [
  usersListRoute,
  usersCreateRoute,
  usersDetailRoute,
  usersEditRoute,
]
