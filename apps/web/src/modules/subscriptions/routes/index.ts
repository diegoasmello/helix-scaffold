import {
  getSubscriptionsIdSuspenseQueryOptions,
  getSubscriptionsSuspenseQueryOptions,
  getSubscriptionStatusQueryOptions,
  getUsersAllSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import { createRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import type { SubscriptionItem } from '../types'

async function assertSubscriptionEnabled() {
  const { enabled } = await queryClient.ensureQueryData(
    getSubscriptionStatusQueryOptions()
  )
  if (!enabled) throw redirect({ to: '/' })
}
import { SubscriptionsCreate } from './subscriptions-create'
import { SubscriptionsDetail } from './subscriptions-detail'
import { SubscriptionsEdit } from './subscriptions-edit'
import { SubscriptionsList } from './subscriptions-list'
import { SubscriptionsPending } from './subscriptions-pending'
import { UpgradeRequired } from './upgrade-required'

export const subscriptionsListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/subscriptions',
  component: SubscriptionsList,
  pendingComponent: SubscriptionsPending,
  staticData: {
    breadcrumbs: [{ label: 'nav.subscriptions' }],
  },
  beforeLoad: async ({ context }) => {
    if (!context.hasPermission('subscriptions', 'view'))
      throw redirect({ to: '/403' })
    await assertSubscriptionEnabled()
  },
  validateSearch: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z
      .enum(['planId', 'status', 'currentPeriodEnd', 'createdAt'])
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  loaderDeps: ({ search: { page, pageSize, sortBy, sortOrder } }) => ({
    page,
    pageSize,
    sortBy,
    sortOrder,
  }),
  loader: ({ deps }) =>
    queryClient.ensureQueryData(getSubscriptionsSuspenseQueryOptions(deps)),
})

export const subscriptionsCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/subscriptions/create',
  component: SubscriptionsCreate,
  pendingComponent: SubscriptionsPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.subscriptions', to: '/subscriptions' },
      { label: 'actions.create' },
    ],
  },
  beforeLoad: async ({ context }) => {
    if (!context.hasPermission('subscriptions', 'create'))
      throw redirect({ to: '/403' })
    await assertSubscriptionEnabled()
  },
  loader: () => {
    queryClient.ensureQueryData(getUsersAllSuspenseQueryOptions())
  },
})

export const subscriptionsDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/subscriptions/$id',
  component: SubscriptionsDetail,
  pendingComponent: SubscriptionsPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.subscriptions', to: '/subscriptions' },
      { label: 'actions.view' },
      (data) => ({ label: `#${(data as SubscriptionItem).id}` }),
    ],
  },
  beforeLoad: async ({ context }) => {
    if (!context.hasPermission('subscriptions', 'view'))
      throw redirect({ to: '/403' })
    await assertSubscriptionEnabled()
  },
  loader: ({ params }) =>
    queryClient.ensureQueryData(
      getSubscriptionsIdSuspenseQueryOptions(params.id)
    ),
})

export const subscriptionsEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/subscriptions/$id/edit',
  component: SubscriptionsEdit,
  pendingComponent: SubscriptionsPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.subscriptions', to: '/subscriptions' },
      { label: 'actions.edit' },
      (data) => ({ label: `#${(data as SubscriptionItem).id}` }),
    ],
  },
  beforeLoad: async ({ context }) => {
    if (!context.hasPermission('subscriptions', 'edit'))
      throw redirect({ to: '/403' })
    await assertSubscriptionEnabled()
  },
  loader: ({ params }) =>
    queryClient.ensureQueryData(
      getSubscriptionsIdSuspenseQueryOptions(params.id)
    ),
})

// Where route guards send users whose plan lacks a feature:
// throw redirect({ to: '/upgrade', search: { feature: 'reports' } })
export const upgradeRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/upgrade',
  component: UpgradeRequired,
  validateSearch: z.object({ feature: z.string().optional() }),
  beforeLoad: async ({ context, search }) => {
    await assertSubscriptionEnabled()
    if (context.hasSubscriptionAccess(search.feature)) {
      throw redirect({ to: '/' })
    }
  },
})

export const subscriptionsRoutes = [
  subscriptionsListRoute,
  subscriptionsCreateRoute,
  subscriptionsDetailRoute,
  subscriptionsEditRoute,
  upgradeRoute,
]
