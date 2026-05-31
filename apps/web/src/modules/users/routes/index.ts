import {
  getRolesAllSuspenseQueryOptions,
  getUsersIdSuspenseQueryOptions,
  getUsersSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

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
    breadcrumbs: [{ label: 'nav.users' }],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('users', 'view')) throw redirect({ to: '/403' })
  },
  validateSearch: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['name', 'email', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  loaderDeps: ({ search: { page, pageSize, sortBy, sortOrder } }) => ({
    page,
    pageSize,
    sortBy,
    sortOrder,
  }),
  loader: ({ deps }) =>
    queryClient.ensureQueryData(getUsersSuspenseQueryOptions(deps)),
})

export const usersCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users/create',
  component: UsersCreate,
  pendingComponent: UsersPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.users', to: '/users' },
      { label: 'actions.create' },
    ],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('users', 'create'))
      throw redirect({ to: '/403' })
  },
  loader: () => {
    queryClient.ensureQueryData(getRolesAllSuspenseQueryOptions())
  },
})

export const usersDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users/$id',
  component: UsersDetail,
  pendingComponent: UsersPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.users', to: '/users' },
      { label: 'actions.view' },
      (data) => ({ label: `#${(data as UserItem).id}` }),
    ],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('users', 'view')) throw redirect({ to: '/403' })
  },
  loader: ({ params }) =>
    queryClient.ensureQueryData(getUsersIdSuspenseQueryOptions(params.id)),
})

export const usersEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/users/$id/edit',
  component: UsersEdit,
  pendingComponent: UsersPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.users', to: '/users' },
      { label: 'actions.edit' },
      (data) => ({ label: `#${(data as UserItem).id}` }),
    ],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('users', 'edit')) throw redirect({ to: '/403' })
  },
  loader: ({ params }) => {
    queryClient.ensureQueryData(getRolesAllSuspenseQueryOptions())
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
