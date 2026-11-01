import { deleteUsersId, useGetUsersSuspense } from '@helix/api-client/hooks'
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
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useResourceCache } from '@/lib/resource-cache'

import { HasPermission } from '../../auth/components/has-permission'
import type { UserItem } from '../types'
import { usersListRoute } from '.'

export function UsersList() {
  const resourceCache = useResourceCache()
  const navigate = usersListRoute.useNavigate()
  const search = usersListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder } = search
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')

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
      textAlign: 'center',
      width: '1%',
      render: (item) => (
        <Group gap="xs" wrap="nowrap">
          <Button
            size="xs"
            variant="default"
            aria-label="View"
            onClick={() =>
              navigate({ to: '/users/$id', params: { id: item.id } })
            }
          >
            {tc('actions.view')}
          </Button>
          <HasPermission resource="users" action="edit">
            <Button
              size="xs"
              variant="default"
              aria-label="Edit"
              onClick={() =>
                navigate({ to: '/users/$id/edit', params: { id: item.id } })
              }
            >
              {tc('actions.edit')}
            </Button>
          </HasPermission>
          <HasPermission resource="users" action="delete">
            <Button
              size="xs"
              variant="default"
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
