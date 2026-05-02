import {
  getRolesIdSuspenseQueryOptions,
  getRolesSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'

import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import type { RoleItem } from '../types'
import { RolesCreate } from './roles-create'
import { RolesDetail } from './roles-detail'
import { RolesEdit } from './roles-edit'
import { RolesList } from './roles-list'
import { RolesPending } from './roles-pending'

export const rolesListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/roles',
  component: RolesList,
  pendingComponent: RolesPending,
  staticData: {
    breadcrumbs: [{ label: 'Roles' }],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('roles', 'view')) throw redirect({ to: '/403' })
  },
  loader: () => queryClient.ensureQueryData(getRolesSuspenseQueryOptions()),
})

export const rolesCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/roles/create',
  component: RolesCreate,
  pendingComponent: RolesPending,
  staticData: {
    breadcrumbs: [{ label: 'Roles', to: '/roles' }, { label: 'Create' }],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('roles', 'create'))
      throw redirect({ to: '/403' })
  },
})

export const rolesDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/roles/$id',
  component: RolesDetail,
  pendingComponent: RolesPending,
  staticData: {
    breadcrumbs: [
      { label: 'Roles', to: '/roles' },
      { label: 'View' },
      (data) => ({ label: `#${(data as RoleItem).id}` }),
    ],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('roles', 'view')) throw redirect({ to: '/403' })
  },
  loader: ({ params }) =>
    queryClient.ensureQueryData(getRolesIdSuspenseQueryOptions(params.id)),
})

export const rolesEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/roles/$id/edit',
  component: RolesEdit,
  pendingComponent: RolesPending,
  staticData: {
    breadcrumbs: [
      { label: 'Roles', to: '/roles' },
      { label: 'Edit' },
      (data) => ({ label: `#${(data as RoleItem).id}` }),
    ],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('roles', 'edit')) throw redirect({ to: '/403' })
  },
  loader: ({ params }) =>
    queryClient.ensureQueryData(getRolesIdSuspenseQueryOptions(params.id)),
})

export const rolesRoutes = [
  rolesListRoute,
  rolesCreateRoute,
  rolesDetailRoute,
  rolesEditRoute,
]
