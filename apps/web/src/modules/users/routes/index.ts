import {
  getRolesAllSuspenseQueryOptions,
  getUsersIdSuspenseQueryOptions,
  getUsersSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { guardPage } from '@/modules/auth/page-access'
import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import type { UserItem } from '../types'
import { USERS_ACCESS } from './access'
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
  beforeLoad: guardPage(USERS_ACCESS.view),
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
  beforeLoad: guardPage(USERS_ACCESS.create),
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
  beforeLoad: guardPage(USERS_ACCESS.view),
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
  beforeLoad: guardPage(USERS_ACCESS.edit),
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
