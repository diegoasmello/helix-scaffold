import { useGetAuditLogsSuspense } from '@helix/api-client/hooks'
import type { AuditLog } from '@helix/api-client/types'
import {
  ActionIcon,
  Badge,
  DataTable,
  type DataTableColumn,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  PageList,
} from '@helix/ui'
import { IconEye } from '@helix/ui'

import { auditListRoute } from '.'

const ACTION_COLORS: Record<string, string> = {
  create: 'green',
  edit: 'blue',
  delete: 'red',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
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
      render: (log) => formatDate(log.createdAt),
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
      width: 80,
      render: (log) => (
        <ActionIcon
          variant="light"
          aria-label="View"
          onClick={() =>
            navigate({ to: '/audit/$id', params: { id: log.id } })
          }
        >
          <IconEye style={{ width: '70%', height: '70%' }} stroke={1.5} />
        </ActionIcon>
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
