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
  type FilterFieldDef,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  Group,
  LogicalFilterForm,
  type LogicalFilterValue,
  notify,
  Paper,
} from '@helix/ui'
import { IconFilter, IconPlus } from '@helix/ui'
import { PageList } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parseISO } from 'date-fns'
import { useState } from 'react'

import { formatDate } from '@/utils/date'

import type { TodoItem } from '../types'
import { todoListRoute } from '.'

const TODO_FILTER_FIELDS: FilterFieldDef[] = [
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'description', label: 'Description', type: 'text' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'completed', label: 'Completed' },
    ],
  },
  { name: 'date', label: 'Date', type: 'date' },
]

export function TodoList() {
  const navigate = todoListRoute.useNavigate()
  const search = todoListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder, filters, filterLogic } = search
  const queryClient = useQueryClient()

  const [filtersOpen, setFiltersOpen] = useState<boolean>(!!filters)

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
        message: 'Todo deleted successfully',
      })
    },
  })

  const handleConfirmDelete = (id: string) => {
    confirm({
      status: 'danger',
      title: 'Delete todo',
      message:
        'Are you sure you want to delete this todo? This action cannot be undone.',
      confirmLabel: 'Delete',
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
      title: 'Title',
      width: '60%',
      sortable: true,
      ellipsis: true,
    },
    {
      accessor: 'date',
      title: 'Date',
      width: '20%',
      sortable: true,
      textAlign: 'center',
      render: (record) => formatDate(parseISO(record.date), 'short'),
    },
    {
      accessor: 'status',
      title: 'Status',
      width: '20%',
      sortable: true,
      textAlign: 'center',
      render: (item) => (
        <Badge
          color={item.status === 'completed' ? 'green' : 'gray'}
          variant="light"
        >
          {item.status === 'completed' ? 'Completed' : 'Pending'}
        </Badge>
      ),
    },
    {
      accessor: 'actions',
      title: 'Actions',
      textAlign: 'center',
      width: 240,
      render: (item) => (
        <Group gap="xs">
          <Button
            size="xs"
            variant="secondary"
            aria-label="View"
            onClick={() =>
              navigate({ to: '/todos/$id', params: { id: item.id } })
            }
          >
            View
          </Button>
          <Button
            size="xs"
            variant="secondary"
            aria-label="Edit"
            onClick={() =>
              navigate({
                to: '/todos/$id/edit',
                params: { id: item.id },
              })
            }
          >
            Edit
          </Button>
          <Button
            size="xs"
            variant="outline"
            color="red"
            aria-label="Delete"
            onClick={() => handleConfirmDelete(item.id)}
          >
            Delete
          </Button>
        </Group>
      ),
    },
  ]

  return (
    <PageList
      title="Todos"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
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
            Filters
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/todos/create' })}
          >
            Create
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
