import { deleteUsersId, useGetUsersSuspense } from '@helix/api-client/hooks'
import {
  Button,
  confirm,
  DataTable,
  type DataTableColumn,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  notify,
  PageList,
  RowActions,
} from '@helix/ui'
import { IconPlus } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useResourceCache } from '@/lib/resource-cache'

import { HasPermission } from '../../auth/components/has-permission'
import { useAuth } from '../../auth/use-auth'
import type { UserItem } from '../types'
import { usersListRoute } from '.'

export function UsersList() {
  const resourceCache = useResourceCache()
  const navigate = usersListRoute.useNavigate()
  const search = usersListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder } = search
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')
  const { hasPermission } = useAuth()

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
      void resourceCache.removed('users', id)
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
      onConfirm: () => deleteUser(id),
    })
  }

  const columns: DataTableColumn<UserItem>[] = [
    {
      accessor: 'name',
      title: t('columns.name'),
      sortable: true,
      width: '30%',
    },
    {
      accessor: 'role',
      title: t('columns.role'),
      render: (item) => item.role?.name ?? '—',
      width: '30%',
    },
    { accessor: 'email', title: t('columns.email'), sortable: true },
    {
      accessor: 'actions',
      title: t('columns.actions'),
      textAlign: 'right',
      width: '1%',
      render: (item) => (
        <RowActions
          actions={[
            {
              label: tc('actions.view'),
              onClick: () =>
                navigate({ to: '/users/$id', params: { id: item.id } }),
            },
            {
              label: tc('actions.edit'),
              hidden: !hasPermission('users', 'edit'),
              onClick: () =>
                navigate({ to: '/users/$id/edit', params: { id: item.id } }),
            },
            {
              label: tc('actions.delete'),
              danger: true,
              hidden: !hasPermission('users', 'delete'),
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
        <HasPermission resource="users" action="create">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/users/create' })}
          >
            {tc('actions.create')}
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
