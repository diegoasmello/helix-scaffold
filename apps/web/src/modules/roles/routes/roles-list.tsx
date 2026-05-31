import {
  deleteRolesId,
  getRolesIdSuspenseQueryKey,
  getRolesSuspenseQueryKey,
  useGetRolesSuspense,
} from '@helix/api-client/hooks'
import {
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
import { IconPlus } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { HasPermission } from '../../auth/components/has-permission'
import type { RoleItem } from '../types'
import { rolesListRoute } from '.'

export function RolesList() {
  const queryClient = useQueryClient()
  const navigate = rolesListRoute.useNavigate()
  const search = rolesListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder } = search
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')

  const { data: rolesResponse } = useGetRolesSuspense({
    page,
    pageSize,
    sortBy,
    sortOrder,
  })

  const paginationProps = getDataTablePaginationProps(
    rolesResponse,
    search,
    navigate
  )
  const sortingProps = getDataTableSortingProps(search, navigate)

  const { mutate: deleteRole } = useMutation({
    mutationFn: (id: string) => deleteRolesId(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: getRolesSuspenseQueryKey(),
        exact: true,
      })
      queryClient.removeQueries({ queryKey: getRolesIdSuspenseQueryKey(id) })
      notify({ status: 'success', message: t('notifications.deleted') })
    },
    onError: () => {
      notify({ status: 'danger', message: t('notifications.deleteFailed') })
    },
  })

  const handleDelete = (id: string, name: string) => {
    confirm({
      status: 'danger',
      title: t('delete.title'),
      message: t('delete.message', { name }),
      confirmLabel: tc('actions.delete'),
      onConfirm: () => deleteRole(id),
    })
  }

  const columns: DataTableColumn<RoleItem>[] = [
    { accessor: 'name', title: t('columns.name'), sortable: true },
    { accessor: 'description', title: t('columns.description') },
    {
      accessor: 'actions',
      title: t('columns.actions'),
      textAlign: 'center',
      width: 240,
      render: (item) => (
        <Group gap="xs">
          <Button
            size="xs"
            variant="secondary"
            aria-label="View"
            onClick={() =>
              navigate({ to: '/roles/$id', params: { id: item.id } })
            }
          >
            {tc('actions.view')}
          </Button>
          <HasPermission resource="roles" action="edit">
            <Button
              size="xs"
              variant="secondary"
              aria-label="Edit"
              onClick={() =>
                navigate({ to: '/roles/$id/edit', params: { id: item.id } })
              }
            >
              {tc('actions.edit')}
            </Button>
          </HasPermission>
          <HasPermission resource="roles" action="delete">
            <Button
              size="xs"
              variant="secondary"
              aria-label="Delete"
              onClick={() => handleDelete(item.id, item.name)}
            >
              {tc('actions.delete')}
            </Button>
          </HasPermission>
        </Group>
      ),
    },
  ]

  return (
    <PageList
      title={t('title')}
      actions={
        <HasPermission resource="roles" action="create">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/roles/create' })}
          >
            {tc('actions.create')}
          </Button>
        </HasPermission>
      }
    >
      <DataTable
        records={rolesResponse.data}
        columns={columns}
        {...paginationProps}
        {...sortingProps}
      />
    </PageList>
  )
}
