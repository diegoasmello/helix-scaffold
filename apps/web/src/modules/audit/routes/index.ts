import {
  getAuditLogsIdSuspenseQueryOptions,
  getAuditLogsSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import type { AuditLog } from '@helix/api-client/types'
import { createRoute, redirect } from '@tanstack/react-router'

import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import { AuditDetail } from './audit-detail'
import { AuditList } from './audit-list'
import { AuditPending } from './audit-pending'

export const auditListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/audit',
  component: AuditList,
  pendingComponent: AuditPending,
  staticData: {
    breadcrumbs: [{ label: 'Audit Log' }],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('audit', 'view')) throw redirect({ to: '/403' })
  },
  loader: () => queryClient.ensureQueryData(getAuditLogsSuspenseQueryOptions()),
})

export const auditDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/audit/$id',
  component: AuditDetail,
  pendingComponent: AuditPending,
  staticData: {
    breadcrumbs: [
      { label: 'Audit Log', to: '/audit' },
      { label: 'View' },
      (data) => ({ label: `#${(data as AuditLog).id}` }),
    ],
  },
  beforeLoad: ({ context }) => {
    if (!context.hasPermission('audit', 'view')) throw redirect({ to: '/403' })
  },
  loader: ({ params }) =>
    queryClient.ensureQueryData(getAuditLogsIdSuspenseQueryOptions(params.id)),
})

export const auditRoutes = [auditListRoute, auditDetailRoute]
