import {
  deleteUsersId,
  getUsersIdSuspenseQueryKey,
  getUsersSuspenseQueryKey,
  useGetUsersSuspense,
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
  PageList,
} from '@helix/ui'
import { IconEdit, IconEye, IconPlus, IconTrash } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { HasPermission } from '../../auth/components/has-permission'
import type { UserItem } from '../types'
import { usersListRoute } from '.'

export function UsersList() {
  const queryClient = useQueryClient()
  const navigate = usersListRoute.useNavigate()
  const search = usersListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder } = search

  const { data: usersResponse } = useGetUsersSuspense({
    page,
    pageSize,
    sortBy,
    sortOrder,
  })

  const paginationProps = getDataTablePaginationProps(
    usersResponse,
    search,
    navigate
  )
  const sortingProps = getDataTableSortingProps(search, navigate)

  const { mutate: deleteUser } = useMutation({
    mutationFn: (id: string) => deleteUsersId(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: getUsersSuspenseQueryKey(),
        exact: true,
      })
      queryClient.removeQueries({ queryKey: getUsersIdSuspenseQueryKey(id) })
      notify({ status: 'success', message: 'User deleted successfully' })
    },
    onError: () => {
      notify({ status: 'danger', message: 'Failed to delete user' })
    },
  })

  const handleDelete = (id: string, name: string) => {
    confirm({
      status: 'danger',
      title: 'Delete user',
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => deleteUser(id),
    })
  }

  const columns: DataTableColumn<UserItem>[] = [
    { accessor: 'name', title: 'Name', sortable: true, width: '30%' },
    {
      accessor: 'role',
      title: 'Role',
      render: (item) => item.role?.name ?? '—',
      width: '30%',
    },
    { accessor: 'email', title: 'Email', sortable: true },
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
              navigate({ to: '/users/$id', params: { id: item.id } })
            }
          >
            <IconEye style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
          <HasPermission resource="users" action="edit">
            <ActionIcon
              variant="light"
              aria-label="Edit"
              onClick={() =>
                navigate({ to: '/users/$id/edit', params: { id: item.id } })
              }
            >
              <IconEdit style={{ width: '70%', height: '70%' }} stroke={1.5} />
            </ActionIcon>
          </HasPermission>
          <HasPermission resource="users" action="delete">
            <ActionIcon
              variant="light"
              color="red"
              aria-label="Delete"
              onClick={() => handleDelete(item.id, item.name)}
            >
              <IconTrash style={{ width: '70%', height: '70%' }} stroke={1.5} />
            </ActionIcon>
          </HasPermission>
        </Group>
      ),
    },
  ]

  return (
    <PageList
      title="Users"
      actions={
        <HasPermission resource="users" action="create">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/users/create' })}
          >
            Create
          </Button>
        </HasPermission>
      }
    >
      <DataTable
        records={usersResponse.data}
        columns={columns}
        {...paginationProps}
        {...sortingProps}
      />
    </PageList>
  )
}
