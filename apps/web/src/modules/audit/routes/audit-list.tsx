import { useGetAuditLogsSuspense } from '@helix/api-client/hooks'
import type { AuditLog } from '@helix/api-client/types'
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  PageList,
} from '@helix/ui'
import { parseISO } from 'date-fns'

import { formatDateTime } from '@/utils/date'

import { auditListRoute } from '.'

const ACTION_COLORS: Record<string, string> = {
  create: 'green',
  edit: 'blue',
  delete: 'red',
}

export function AuditList() {
  const navigate = auditListRoute.useNavigate()
  const search = auditListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder } = search

  const { data: auditLogsResponse } = useGetAuditLogsSuspense({
    page,
    pageSize,
    sortBy,
    sortOrder,
  })

  const paginationProps = getDataTablePaginationProps(
    auditLogsResponse,
    search,
    navigate
  )
  const sortingProps = getDataTableSortingProps(search, navigate)

  const columns: DataTableColumn<AuditLog>[] = [
    {
      accessor: 'createdAt',
      title: 'Date',
      sortable: true,
      render: (log) => formatDateTime(parseISO(log.createdAt)),
    },
    { accessor: 'userName', title: 'User', sortable: true },
    {
      accessor: 'action',
      title: 'Action',
      sortable: true,
      render: (log) => (
        <Badge color={ACTION_COLORS[log.action] ?? 'gray'} variant="light">
          {log.action}
        </Badge>
      ),
    },
    { accessor: 'resource', title: 'Resource', sortable: true },
    {
      accessor: 'resourceId',
      title: 'Resource ID',
      render: (log) => log.resourceId ?? '—',
    },
    {
      accessor: 'ip',
      title: 'IP',
      render: (log) => log.ip ?? '—',
    },
    {
      accessor: 'actions',
      title: 'Actions',
      textAlign: 'center',
      width: 96,
      render: (log) => (
        <Button
          size="xs"
          variant="secondary"
          aria-label="View"
          onClick={() => navigate({ to: '/audit/$id', params: { id: log.id } })}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <PageList title="Audit Log">
      <DataTable
        records={auditLogsResponse.data}
        columns={columns}
        {...paginationProps}
        {...sortingProps}
      />
    </PageList>
  )
}
