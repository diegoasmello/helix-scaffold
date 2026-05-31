import { useGetAuditLogsSuspense } from '@helix/api-client/hooks'
import type { AuditLog } from '@helix/api-client/types'
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  Group,
  PageList,
} from '@helix/ui'
import { IconDownload } from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { useExportPdf } from '@/lib/use-export-pdf'
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
  const { t } = useTranslation('audit')
  const { t: tc } = useTranslation('common')

  const { isExporting, handleExport } = useExportPdf(
    '/audit-logs/export',
    { sortBy, sortOrder },
    'audit-logs'
  )

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
      title: t('columns.date'),
      sortable: true,
      render: (log) => formatDateTime(parseISO(log.createdAt)),
    },
    { accessor: 'userName', title: t('columns.user'), sortable: true },
    {
      accessor: 'action',
      title: t('columns.action'),
      sortable: true,
      render: (log) => (
        <Badge color={ACTION_COLORS[log.action] ?? 'gray'} variant="light">
          {log.action}
        </Badge>
      ),
    },
    { accessor: 'resource', title: t('columns.resource'), sortable: true },
    {
      accessor: 'resourceId',
      title: t('columns.resourceId'),
      render: (log) => log.resourceId ?? '—',
    },
    {
      accessor: 'ip',
      title: t('columns.ip'),
      render: (log) => log.ip ?? '—',
    },
    {
      accessor: 'actions',
      title: t('columns.actions'),
      textAlign: 'center',
      width: 96,
      render: (log) => (
        <Button
          size="xs"
          variant="secondary"
          aria-label="View"
          onClick={() => navigate({ to: '/audit/$id', params: { id: log.id } })}
        >
          {tc('actions.view')}
        </Button>
      ),
    },
  ]

  return (
    <PageList
      title={t('title')}
      actions={
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            loading={isExporting}
            onClick={handleExport}
          >
            {tc('actions.exportPdf')}
          </Button>
        </Group>
      }
    >
      <DataTable
        records={auditLogsResponse.data}
        columns={columns}
        {...paginationProps}
        {...sortingProps}
      />
    </PageList>
  )
}
