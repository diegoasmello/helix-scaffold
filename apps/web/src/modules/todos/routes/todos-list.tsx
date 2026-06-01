import {
  deleteTodosId,
  getTodosIdSuspenseQueryKey,
  getTodosSuspenseQueryKey,
  useGetTodosSuspense,
} from '@helix/api-client/hooks'
import {
  Badge,
  Button,
  Collapse,
  confirm,
  DataTable,
  type DataTableColumn,
  EmptyState,
  type FilterFieldDef,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  Group,
  LogicalFilterForm,
  type LogicalFilterValue,
  notify,
  Paper,
} from '@helix/ui'
import { IconDownload, IconFilter, IconPlus } from '@helix/ui'
import { PageList } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parseISO } from 'date-fns'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useExportPdf } from '@/lib/use-export-pdf'
import { formatDate } from '@/utils/date'

import type { TodoItem } from '../types'
import { todoListRoute } from '.'

export function TodoList() {
  const { t } = useTranslation('todos')

  const navigate = todoListRoute.useNavigate()
  const search = todoListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder, filters, filterLogic } = search
  const queryClient = useQueryClient()

  const [filtersOpen, setFiltersOpen] = useState<boolean>(!!filters)
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

  const filterValue: LogicalFilterValue = {
    conditions: filters
      ? (JSON.parse(filters) as LogicalFilterValue['conditions'])
      : [],
    logic: filterLogic,
  }
  const activeFilterCount = filterValue.conditions.length

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
      queryClient.invalidateQueries({
        queryKey: getTodosSuspenseQueryKey(),
      })
      queryClient.removeQueries({ queryKey: getTodosIdSuspenseQueryKey(id) })
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

  const handleApplyFilters = (value: LogicalFilterValue) => {
    const hasFilters = value.conditions.length > 0
    navigate({
      search: (prev) => ({
        ...prev,
        filters: hasFilters ? JSON.stringify(value.conditions) : undefined,
        filterLogic: value.logic,
        page: 1,
      }),
    })
    if (!hasFilters) setFiltersOpen(false)
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
        <Badge
          color={item.status === 'completed' ? 'green' : 'gray'}
          variant="light"
        >
          {item.status === 'completed'
            ? t('status.completed')
            : t('status.pending')}
        </Badge>
      ),
    },
    {
      accessor: 'actions',
      title: t('columns.actions'),
      textAlign: 'center',
      width: '1%',
      render: (item) => (
        <Group gap="xs" wrap="nowrap">
          <Button
            size="xs"
            variant="default"
            aria-label="View"
            onClick={() =>
              navigate({ to: '/todos/$id', params: { id: item.id } })
            }
          >
            {t('actions.view', { ns: 'common' })}
          </Button>
          <Button
            size="xs"
            variant="default"
            aria-label="Edit"
            onClick={() =>
              navigate({
                to: '/todos/$id/edit',
                params: { id: item.id },
              })
            }
          >
            {t('actions.edit', { ns: 'common' })}
          </Button>
          <Button
            size="xs"
            variant="default"
            aria-label="Delete"
            onClick={() => handleConfirmDelete(item.id)}
          >
            {t('actions.delete', { ns: 'common' })}
          </Button>
        </Group>
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
            variant={activeFilterCount > 0 ? 'light' : 'default'}
            leftSection={<IconFilter size={16} />}
            onClick={() => setFiltersOpen((o) => !o)}
            rightSection={
              activeFilterCount > 0 ? (
                <Badge size="xs" circle>
                  {activeFilterCount}
                </Badge>
              ) : undefined
            }
          >
            {t('actions.filters', { ns: 'common' })}
          </Button>
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
      <Collapse expanded={filtersOpen}>
        <Paper p="md">
          <LogicalFilterForm
            key={filters ?? ''}
            fields={TODO_FILTER_FIELDS}
            value={filterValue}
            onApply={handleApplyFilters}
          />
        </Paper>
      </Collapse>

      <DataTable
        records={todosResponse.data}
        columns={columns}
        {...paginationProps}
        {...sortingProps}
      />
    </PageList>
  )
}
