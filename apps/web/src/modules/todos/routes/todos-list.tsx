import {
  deleteTodosId,
  getTodosIdSuspenseQueryKey,
  getTodosSuspenseQueryKey,
  useGetTodosSuspense,
} from '@helix/api-client/hooks'
import {
  ActionIcon,
  Button,
  confirm,
  DataTable,
  type DataTableColumn,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  Group,
  notify,
} from '@helix/ui'
import { IconEdit, IconEye, IconPlus, IconTrash } from '@helix/ui'
import { PageList } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { TodoItem } from '../types'
import { todoListRoute } from '.'

export function TodoList() {
  const navigate = todoListRoute.useNavigate()
  const search = todoListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder } = search
  const queryClient = useQueryClient()

  const { data: todosResponse } = useGetTodosSuspense({
    page,
    pageSize,
    sortBy,
    sortOrder,
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
      title: 'Confirm Deletion',
      message:
        'Are you sure you want to delete this todo? This action cannot be undone.',
      onConfirm: () => deleteTodo(id),
    })
  }

  const columns: DataTableColumn<TodoItem>[] = [
    {
      accessor: 'title',
      title: 'Title',
      sortable: true,
      width: '60%',
    },
    {
      accessor: 'date',
      title: 'Date',
      sortable: true,
      width: '20%',
    },
    {
      accessor: 'status',
      title: 'Status',
      sortable: true,
    },
    {
      accessor: 'actions',
      title: 'Actions',
      textAlign: 'center',
      width: 124,
      render: (item) => (
        <Group gap="xs">
          <ActionIcon
            variant="light"
            aria-label="View"
            onClick={() =>
              navigate({ to: '/todos/$id', params: { id: item.id } })
            }
          >
            <IconEye style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            aria-label="Edit"
            onClick={() =>
              navigate({
                to: '/todos/$id/edit',
                params: { id: item.id },
              })
            }
          >
            <IconEdit style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="red"
            aria-label="Delete"
            onClick={() => handleConfirmDelete(item.id)}
          >
            <IconTrash style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
        </Group>
      ),
    },
  ]

  return (
    <PageList
      title="Todos"
      actions={
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate({ to: '/todos/create' })}
        >
          Create
        </Button>
      }
    >
      <DataTable
        records={todosResponse.data}
        columns={columns}
        {...paginationProps}
        {...sortingProps}
      />
    </PageList>
  )
}
