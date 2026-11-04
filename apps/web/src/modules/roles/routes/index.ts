import {
  getPermissionsResourcesSuspenseQueryOptions,
  getRolesIdPermissionsSuspenseQueryOptions,
  getRolesIdSuspenseQueryOptions,
  getRolesSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { guardPage } from '@/modules/auth/page-access'
import { registrationStatusQueryOptions } from '@/modules/auth/use-registration-open'
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

/**
 * Loads the role for a page that changes it — the admin role is locked for
 * everyone (API: `admin_role_locked`), so its pages send back to the detail.
 */
async function loadManageableRole(id: string) {
  const role = await queryClient.ensureQueryData(
    getRolesIdSuspenseQueryOptions(id)
  )
  if (role.isAdmin) {
    throw redirect({ to: '/roles/$id', params: { id } })
  }
  return role
}

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
  // The default-role switch shows only in open registration (`RolesForm`)
  loader: () => queryClient.ensureQueryData(registrationStatusQueryOptions()),
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
  loader: ({ params, context }) => {
    // The grants need `permissions:view` — without it the page shows the role
    // alone (see `RolesDetail`), so they are not even requested.
    queryClient.ensureQueryData(registrationStatusQueryOptions())
    if (context.hasPermission('permissions', 'view')) {
      queryClient.ensureQueryData(getPermissionsResourcesSuspenseQueryOptions())
      queryClient.ensureQueryData(
        getRolesIdPermissionsSuspenseQueryOptions(params.id)
      )
    }
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
  loader: ({ params }) => {
    queryClient.ensureQueryData(registrationStatusQueryOptions())
    return loadManageableRole(params.id)
  },
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
  loader: async ({ params }) => {
    const role = await loadManageableRole(params.id)
    queryClient.ensureQueryData(getPermissionsResourcesSuspenseQueryOptions())
    queryClient.ensureQueryData(
      getRolesIdPermissionsSuspenseQueryOptions(params.id)
    )
    return role
  },
})

export const rolesRoutes = [
  rolesListRoute,
  rolesCreateRoute,
  rolesDetailRoute,
  rolesEditRoute,
  rolesPermissionsRoute,
]
