import {
  getAuditLogsIdSuspenseQueryOptions,
  getAuditLogsSuspenseQueryOptions,
} from '@helix/api-client/hooks'
import type { AuditLog } from '@helix/api-client/types'
import { createRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { guardPage } from '@/modules/auth/page-access'
import { authenticatedRoute } from '@/routes'

import { queryClient } from '../../../lib/query-client'
import { AUDIT_ACCESS } from './access'
import { AuditDetail } from './audit-detail'
import { AuditList } from './audit-list'
import { AuditPending } from './audit-pending'

export const auditListRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/audit',
  component: AuditList,
  pendingComponent: AuditPending,
  staticData: {
    breadcrumbs: [{ label: 'nav.auditLog' }],
  },
  beforeLoad: guardPage(AUDIT_ACCESS.view),
  validateSearch: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['createdAt', 'userName', 'action', 'resource']).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  loaderDeps: ({ search: { page, pageSize, sortBy, sortOrder } }) => ({
    page,
    pageSize,
    sortBy,
    sortOrder,
  }),
  loader: ({ deps }) =>
    queryClient.ensureQueryData(getAuditLogsSuspenseQueryOptions(deps)),
})

export const auditDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/audit/$id',
  component: AuditDetail,
  pendingComponent: AuditPending,
  staticData: {
    breadcrumbs: [
      { label: 'nav.auditLog', to: '/audit' },
      { label: 'actions.view' },
      (data) => ({ label: `#${(data as AuditLog).id}` }),
    ],
  },
  beforeLoad: guardPage(AUDIT_ACCESS.view),
  loader: ({ params }) =>
    queryClient.ensureQueryData(getAuditLogsIdSuspenseQueryOptions(params.id)),
})

export const auditRoutes = [auditListRoute, auditDetailRoute]
