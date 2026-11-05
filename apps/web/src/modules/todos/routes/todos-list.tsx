import { deleteTodosId, useGetTodosSuspense } from '@helix/api-client/hooks'
import {
  Button,
  confirm,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterBar,
  FilteredEmptyState,
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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getFilterBarProps, toApiFilters } from '@/lib/list-filters'
import { useResourceCache } from '@/lib/resource-cache'
import { useExportPdf } from '@/lib/use-export-pdf'
import { formatDate } from '@/utils/date'

import { HasPermission } from '../../auth/components/has-permission'
import { useAuth } from '../../auth/use-auth'
import type { TodoItem } from '../types'
import { todoListRoute } from '.'
import { TODO_INSTANT_FILTERS } from './filters'

export function TodoList() {
  const { t } = useTranslation('todos')

  const navigate = todoListRoute.useNavigate()
  const { hasPermission } = useAuth()
  const search = todoListRoute.useSearch()
  const {
    page,
    pageSize,
    sortBy,
    sortOrder,
    filters,
    filterLogic,
    search: searchTerm,
  } = search
  const resourceCache = useResourceCache()
  // The URL keeps the days the user picked; the API compares `createdAt` with
  // instants. The loader makes the same call, so the query keys match.
  const apiFilters = toApiFilters(filters, TODO_INSTANT_FILTERS)

  const { isExporting, handleExport } = useExportPdf(
    '/todos/export',
    { sortBy, sortOrder, filters: apiFilters, filterLogic, search: searchTerm },
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
    { name: 'published', label: t('filters.published'), type: 'boolean' },
    { name: 'date', label: t('filters.date'), type: 'date' },
    { name: 'createdAt', label: t('filters.createdAt'), type: 'date' },
  ]

  const {
    active: narrowed,
    clearAll,
    ...filterBarProps
  } = getFilterBarProps(search, navigate, { withSearch: true })
  const [filtersOpened, setFiltersOpened] = useState(false)

  const { data: todosResponse } = useGetTodosSuspense({
    page,
    pageSize,
    sortBy,
    sortOrder,
    filters: apiFilters,
    filterLogic,
    search: searchTerm,
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
      width: '45%',
      sortable: true,
      ellipsis: true,
    },
    {
      accessor: 'date',
      title: t('columns.date'),
      width: '15%',
      sortable: true,
      textAlign: 'center',
      render: (record) => formatDate(parseISO(record.date), 'short'),
    },
    {
      accessor: 'published',
      title: t('columns.published'),
      width: '20%',
      textAlign: 'center',
      render: (item) => (
        <StatusBadge tone={item.published ? 'info' : 'neutral'}>
          {item.published ? t('publication.published') : t('publication.draft')}
        </StatusBadge>
      ),
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
      textAlign: 'center',
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
              hidden: !hasPermission('todos', 'edit'),
            },
            {
              label: t('actions.delete', { ns: 'common' }),
              danger: true,
              onClick: () => handleConfirmDelete(item.id),
              hidden: !hasPermission('todos', 'delete'),
            },
          ]}
        />
      ),
    },
  ]

  if (todosResponse.data.length === 0 && !narrowed) {
    return (
      <EmptyState title={t('empty.title')} description={t('empty.description')}>
        <HasPermission resource="todos" action="create">
          <Button
            size="lg"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/todos/create' })}
          >
            {t('empty.createButton')}
          </Button>
        </HasPermission>
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
          <HasPermission resource="todos" action="create">
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate({ to: '/todos/create' })}
            >
              {t('actions.create', { ns: 'common' })}
            </Button>
          </HasPermission>
        </Group>
      }
    >
      <FilterBar
        fields={TODO_FILTER_FIELDS}
        {...filterBarProps}
        search={
          filterBarProps.search && {
            ...filterBarProps.search,
            placeholder: t('filters.search'),
          }
        }
        resultCount={todosResponse.total}
        opened={filtersOpened}
        onOpenedChange={setFiltersOpened}
      />

      <DataTable
        cardTitleAside="status"
        emptyState={
          narrowed ? (
            <FilteredEmptyState
              title={t('noResults.title')}
              description={
                searchTerm
                  ? t('noResults.withSearch', { search: searchTerm })
                  : t('noResults.withoutSearch')
              }
              onEditFilters={() => setFiltersOpened(true)}
              onClear={clearAll}
            />
          ) : undefined
        }
        records={todosResponse.data}
        columns={columns}
        {...paginationProps}
        {...sortingProps}
      />
    </PageList>
  )
}
