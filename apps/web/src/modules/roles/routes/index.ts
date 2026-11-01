import {
  getPermissionsResourcesSuspenseQueryOptions,
  getRolesIdPermissionsSuspenseQueryOptions,
  getRolesIdSuspenseQueryOptions,
  getRolesSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { guardPage } from '@/modules/auth/page-access'
import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import type { RoleItem } from '../types'
import { ROLES_ACCESS } from './access'
import { RolesCreate } from './roles-create'
import { RolesDetail } from './roles-detail'
import { RolesEdit } from './roles-edit'
import { RolesList } from './roles-list'
import { RolesPending } from './roles-pending'
import { RolesPermissions } from './roles-permissions'

export const rolesListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/roles',
  component: RolesList,
  pendingComponent: RolesPending,
  staticData: {
    breadcrumbs: [{ label: 'nav.roles' }],
  },
  beforeLoad: guardPage(ROLES_ACCESS.view),
  validateSearch: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['name', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  loaderDeps: ({ search: { page, pageSize, sortBy, sortOrder } }) => ({
    page,
    pageSize,
    sortBy,
    sortOrder,
  }),
  loader: ({ deps }) =>
    queryClient.ensureQueryData(getRolesSuspenseQueryOptions(deps)),
})

export const rolesCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/roles/create',
  component: RolesCreate,
  pendingComponent: RolesPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.roles', to: '/roles' },
      { label: 'actions.create' },
    ],
  },
  beforeLoad: guardPage(ROLES_ACCESS.create),
})

export const rolesDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/roles/$id',
  component: RolesDetail,
  pendingComponent: RolesPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.roles', to: '/roles' },
      { label: 'actions.view' },
      (data) => ({ label: `#${(data as RoleItem).id}` }),
    ],
  },
  beforeLoad: guardPage(ROLES_ACCESS.view),
  loader: ({ params }) => {
    queryClient.ensureQueryData(getPermissionsResourcesSuspenseQueryOptions())
    queryClient.ensureQueryData(
      getRolesIdPermissionsSuspenseQueryOptions(params.id)
    )
    return queryClient.ensureQueryData(
      getRolesIdSuspenseQueryOptions(params.id)
    )
  },
})

export const rolesEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/roles/$id/edit',
  component: RolesEdit,
  pendingComponent: RolesPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.roles', to: '/roles' },
      { label: 'actions.edit' },
      (data) => ({ label: `#${(data as RoleItem).id}` }),
    ],
  },
  beforeLoad: guardPage(ROLES_ACCESS.edit),
  loader: ({ params }) =>
    queryClient.ensureQueryData(getRolesIdSuspenseQueryOptions(params.id)),
})

export const rolesPermissionsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/roles/$id/permissions',
  component: RolesPermissions,
  pendingComponent: RolesPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.roles', to: '/roles' },
      (data) => ({
        label: (data as RoleItem).name,
        to: `/roles/${(data as RoleItem).id}`,
      }),
      { label: 'nav.permissions' },
    ],
  },
  beforeLoad: guardPage(ROLES_ACCESS.permissions),
  loader: ({ params }) => {
    queryClient.ensureQueryData(getPermissionsResourcesSuspenseQueryOptions())
    queryClient.ensureQueryData(
      getRolesIdPermissionsSuspenseQueryOptions(params.id)
    )
    return queryClient.ensureQueryData(
      getRolesIdSuspenseQueryOptions(params.id)
    )
  },
})

export const rolesRoutes = [
  rolesListRoute,
  rolesCreateRoute,
  rolesDetailRoute,
  rolesEditRoute,
  rolesPermissionsRoute,
]
