import { deleteRolesId, useGetRolesSuspense } from '@helix/api-client/hooks'
import {
  Badge,
  Button,
  confirm,
  DataTable,
  type DataTableColumn,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  Group,
  notify,
  PageList,
  RowActions,
  Text,
} from '@helix/ui'
import { IconPlus } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/lib/api-errors'
import { useResourceCache } from '@/lib/resource-cache'

import { HasPermission } from '../../auth/components/has-permission'
import { hasPagePermission } from '../../auth/page-access'
import { useAuth } from '../../auth/use-auth'
import type { RoleItem } from '../types'
import { rolesListRoute } from '.'
import { ROLES_ACCESS } from './access'

export function RolesList() {
  const resourceCache = useResourceCache()
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
      void resourceCache.removed('roles', id)
      notify({ status: 'success', message: t('notifications.deleted') })
    },
    onError: (error) => {
      // e.g. the default registration role, or a role that still has users
      notify({
        status: 'danger',
        message: apiErrorMessage(error, 'roles', 'notifications.deleteFailed'),
      })
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
    {
      accessor: 'name',
      title: t('columns.name'),
      sortable: true,
      render: (item) => (
        <Group gap="sm" wrap="nowrap">
          <Text size="sm" truncate="end">
            {item.name}
          </Text>
          {item.isAdmin && <Badge variant="light">{t('admin.badge')}</Badge>}
        </Group>
      ),
    },
    { accessor: 'description', title: t('columns.description') },
    {
      accessor: 'actions',
      title: t('columns.actions'),
      textAlign: 'center',
      width: '1%',
      render: (item) => (
        <RowActions
          maxInlineActions={4}
          actions={[
            {
              label: tc('actions.view'),
              onClick: () =>
                navigate({ to: '/roles/$id', params: { id: item.id } }),
            },
            {
              label: tc('actions.edit'),
              // The admin role is locked for everyone (API: admin_role_locked)
              hidden: item.isAdmin || !hasPermission('roles', 'edit'),
              onClick: () =>
                navigate({ to: '/roles/$id/edit', params: { id: item.id } }),
            },
            {
              label: t('permissions.editButton'),
              hidden:
                item.isAdmin ||
                !hasPagePermission(ROLES_ACCESS.permissions, hasPermission),
              onClick: () =>
                navigate({
                  to: '/roles/$id/permissions',
                  params: { id: item.id },
                }),
            },
            {
              label: tc('actions.delete'),
              danger: true,
              hidden: item.isAdmin || !hasPermission('roles', 'delete'),
              onClick: () => handleDelete(item.id, item.name),
            },
          ]}
        />
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
