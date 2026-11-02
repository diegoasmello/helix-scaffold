import { deleteTodosId, useGetTodosSuspense } from '@helix/api-client/hooks'
import {
  Button,
  confirm,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  type FilterFieldDef,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  Group,
  notify,
  RowActions,
  StatusBadge,
} from '@helix/ui'
import { IconDownload, IconPlus } from '@helix/ui'
import { PageList } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { getFilterBarProps } from '@/lib/list-filters'
import { useResourceCache } from '@/lib/resource-cache'
import { useExportPdf } from '@/lib/use-export-pdf'
import { formatDate } from '@/utils/date'

import type { TodoItem } from '../types'
import { todoListRoute } from '.'

export function TodoList() {
  const { t } = useTranslation('todos')

  const navigate = todoListRoute.useNavigate()
  const search = todoListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder, filters, filterLogic } = search
  const resourceCache = useResourceCache()

  const { isExporting, handleExport } = useExportPdf(
    '/todos/export',
    { sortBy, sortOrder, filters, filterLogic },
    'todos'
  )

  const TODO_FILTER_FIELDS: FilterFieldDef[] = [
    { name: 'title', label: t('filters.title'), type: 'text' },
    { name: 'description', label: t('filters.description'), type: 'text' },
    {
      name: 'status',
      label: t('filters.status'),
      type: 'select',
      options: [
        { value: 'pending', label: t('filters.statusPending') },
        { value: 'completed', label: t('filters.statusCompleted') },
      ],
    },
    { name: 'date', label: t('filters.date'), type: 'date' },
  ]

  const filterBarProps = getFilterBarProps(search, navigate)

  const { data: todosResponse } = useGetTodosSuspense({
    page,
    pageSize,
    sortBy,
    sortOrder,
    filters,
    filterLogic,
  })

  const paginationProps = getDataTablePaginationProps(
    todosResponse,
    search,
    navigate
  )

  const sortingProps = getDataTableSortingProps(search, navigate)

  const { mutate: deleteTodo } = useMutation({
    mutationFn: (id: string) => deleteTodosId(id),
    onSuccess: (_, id) => {
      void resourceCache.removed('todos', id)
      notify({
        status: 'success',
        message: t('notifications.deleted'),
      })
    },
    onError: () => {
      notify({ status: 'danger', message: t('notifications.deleteFailed') })
    },
  })

  const handleConfirmDelete = (id: string) => {
    confirm({
      status: 'danger',
      title: t('delete.title'),
      message: t('delete.message'),
      confirmLabel: t('actions.delete', { ns: 'common' }),
      onConfirm: () => deleteTodo(id),
    })
  }

  const columns: DataTableColumn<TodoItem>[] = [
    {
      accessor: 'title',
      title: t('columns.title'),
      width: '60%',
      sortable: true,
      ellipsis: true,
    },
    {
      accessor: 'date',
      title: t('columns.date'),
      width: '20%',
      sortable: true,
      textAlign: 'center',
      render: (record) => formatDate(parseISO(record.date), 'short'),
    },
    {
      accessor: 'status',
      title: t('columns.status'),
      width: '20%',
      sortable: true,
      textAlign: 'center',
      render: (item) => (
        <StatusBadge tone={item.status === 'completed' ? 'success' : 'warning'}>
          {item.status === 'completed'
            ? t('status.completed')
            : t('status.pending')}
        </StatusBadge>
      ),
    },
    {
      accessor: 'actions',
      title: t('columns.actions'),
      textAlign: 'right',
      width: '1%',
      render: (item) => (
        <RowActions
          actions={[
            {
              label: t('actions.view', { ns: 'common' }),
              onClick: () =>
                navigate({ to: '/todos/$id', params: { id: item.id } }),
            },
            {
              label: t('actions.edit', { ns: 'common' }),
              onClick: () =>
                navigate({ to: '/todos/$id/edit', params: { id: item.id } }),
            },
            {
              label: t('actions.delete', { ns: 'common' }),
              danger: true,
              onClick: () => handleConfirmDelete(item.id),
            },
          ]}
        />
      ),
    },
  ]

  if (todosResponse.data.length === 0 && !filters) {
    return (
      <EmptyState title={t('empty.title')} description={t('empty.description')}>
        <Button
          size="lg"
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate({ to: '/todos/create' })}
        >
          {t('empty.createButton')}
        </Button>
      </EmptyState>
    )
  }

  return (
    <PageList
      title={t('title')}
      description={t('description')}
      actions={
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            loading={isExporting}
            onClick={handleExport}
          >
            {t('actions.exportPdf', { ns: 'common' })}
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/todos/create' })}
          >
            {t('actions.create', { ns: 'common' })}
          </Button>
        </Group>
      }
    >
      <FilterBar fields={TODO_FILTER_FIELDS} {...filterBarProps} />

      <DataTable
        records={todosResponse.data}
        columns={columns}
        {...paginationProps}
        {...sortingProps}
      />
    </PageList>
  )
}
