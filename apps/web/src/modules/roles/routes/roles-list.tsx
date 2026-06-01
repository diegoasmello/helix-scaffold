import {
  deleteRolesId,
  getRolesIdSuspenseQueryKey,
  getRolesSuspenseQueryKey,
  useGetRolesSuspense,
} from '@helix/api-client/hooks'
import {
  ActionsMenu,
  type ActionsMenuItemConfig,
  Button,
  confirm,
  DataTable,
  type DataTableColumn,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  notify,
  PageList,
} from '@helix/ui'
import { IconPlus } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { HasPermission } from '../../auth/components/has-permission'
import { useAuth } from '../../auth/use-auth'
import type { RoleItem } from '../types'
import { rolesListRoute } from '.'

export function RolesList() {
  const queryClient = useQueryClient()
  const navigate = rolesListRoute.useNavigate()
  const search = rolesListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder } = search
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')
  const { hasPermission } = useAuth()

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
      width: '1%',
      render: (item) => {
        const items: ActionsMenuItemConfig[] = [
          {
            label: tc('actions.view'),
            onClick: () =>
              navigate({ to: '/roles/$id', params: { id: item.id } }),
          },
          ...(hasPermission('roles', 'edit')
            ? [
                {
                  label: tc('actions.edit'),
                  onClick: () =>
                    navigate({
                      to: '/roles/$id/edit',
                      params: { id: item.id },
                    }),
                },
              ]
            : []),
          ...(hasPermission('permissions', 'edit')
            ? [
                {
                  label: t('permissions.editButton'),
                  onClick: () =>
                    navigate({
                      to: '/roles/$id/permissions',
                      params: { id: item.id },
                    }),
                },
              ]
            : []),
          ...(hasPermission('roles', 'delete')
            ? [
                {
                  label: tc('actions.delete'),
                  color: 'red' as const,
                  onClick: () => handleDelete(item.id, item.name),
                },
              ]
            : []),
        ]
        return <ActionsMenu items={items} />
      },
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
