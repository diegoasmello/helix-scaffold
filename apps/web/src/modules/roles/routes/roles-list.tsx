import {
  deleteRolesId,
  getRolesIdSuspenseQueryKey,
  getRolesSuspenseQueryKey,
  useGetRolesSuspense,
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
import { rolesListRoute } from '.'

export function RolesList() {
  const queryClient = useQueryClient()
  const navigate = rolesListRoute.useNavigate()

  const { data: roles } = useGetRolesSuspense()

  const { mutate: deleteRole } = useMutation({
    mutationFn: (id: string) => deleteRolesId(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: getRolesSuspenseQueryKey(),
        exact: true,
      })
      queryClient.removeQueries({ queryKey: getRolesIdSuspenseQueryKey(id) })
      notify({ status: 'success', message: 'Role deleted successfully' })
    },
    onError: () => {
      notify({ status: 'danger', message: 'Failed to delete role' })
    },
  })

  const handleDelete = (id: string, name: string) => {
    confirm({
      status: 'danger',
      title: 'Delete role',
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => deleteRole(id),
    })
  }

  const rows = roles.map((item) => (
    <Table.Tr key={item.id}>
      <Table.Td>{item.name}</Table.Td>
      <Table.Td>{item.description}</Table.Td>
      <Table.Td>{item.createdAt}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="light"
            aria-label="View"
            onClick={() =>
              navigate({ to: '/roles/$id', params: { id: item.id } })
            }
          >
            <IconEye style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
          <HasPermission resource="roles" action="edit">
            <ActionIcon
              variant="light"
              aria-label="Edit"
              onClick={() =>
                navigate({ to: '/roles/$id/edit', params: { id: item.id } })
              }
            >
              <IconEdit style={{ width: '70%', height: '70%' }} stroke={1.5} />
            </ActionIcon>
          </HasPermission>
          <HasPermission resource="roles" action="delete">
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
      title="Roles"
      actions={
        <HasPermission resource="roles" action="create">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/roles/create' })}
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
            <Table.Th>Description</Table.Th>
            <Table.Th>Created At</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </PageList>
  )
}
