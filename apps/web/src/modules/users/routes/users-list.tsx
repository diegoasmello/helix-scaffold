import {
  deleteUsersId,
  getUsersIdSuspenseQueryKey,
  getUsersSuspenseQueryKey,
  useGetRolesSuspense,
  useGetUsersSuspense,
} from '@helix/api-client/hooks'
import {
  ActionIcon,
  Button,
  confirm,
  Group,
  notify,
  PageList,
  Table,
} from '@helix/ui'
import { IconEdit, IconEye, IconPlus, IconTrash } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { HasPermission } from '../../auth/components/has-permission'
import { usersListRoute } from '.'

export function UsersList() {
  const queryClient = useQueryClient()
  const navigate = usersListRoute.useNavigate()

  const { data: users } = useGetUsersSuspense()
  const { data: roles } = useGetRolesSuspense()

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

  const roleMap = new Map(roles.map((r) => [r.id, r.name]))

  const handleDelete = (id: string, name: string) => {
    confirm({
      status: 'danger',
      title: 'Delete user',
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => deleteUser(id),
    })
  }

  const rows = users.map((item) => (
    <Table.Tr key={item.id}>
      <Table.Td>{item.name}</Table.Td>
      <Table.Td>{item.email}</Table.Td>
      <Table.Td>
        {item.roleId ? (roleMap.get(item.roleId) ?? item.roleId) : '—'}
      </Table.Td>
      <Table.Td>
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
      </Table.Td>
    </Table.Tr>
  ))

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
      <Table verticalSpacing="sm" withTableBorder highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </PageList>
  )
}
