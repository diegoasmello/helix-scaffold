import { deleteUsersId, useGetUsersSuspense } from '@helix/api-client/hooks'
import {
  Avatar,
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
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/lib/api-errors'
import { useResourceCache } from '@/lib/resource-cache'
import { formatDate } from '@/utils/date'

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
    onError: (error) => {
      // e.g. the admin account, or a user whose role grants more than yours
      notify({
        status: 'danger',
        message: apiErrorMessage(error, 'users', 'notifications.deleteFailed'),
      })
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
      render: (item) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar name={item.name} color="initials" size={34} />
          <Text size="sm" fw={500} truncate="end">
            {item.name}
          </Text>
        </Group>
      ),
    },
    { accessor: 'email', title: t('columns.email'), sortable: true },
    {
      accessor: 'role',
      title: t('columns.role'),
      width: 160,
      render: (item) =>
        item.role ? <Badge variant="default">{item.role.name}</Badge> : '—',
    },
    {
      accessor: 'createdAt',
      title: t('columns.createdAt'),
      sortable: true,
      width: 140,
      render: (item) => formatDate(parseISO(item.createdAt), 'short'),
    },
    {
      accessor: 'actions',
      title: t('columns.actions'),
      textAlign: 'center',
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
              // The admin account is locked here (API: admin_user_locked)
              hidden: !!item.role?.isAdmin || !hasPermission('users', 'edit'),
              onClick: () =>
                navigate({ to: '/users/$id/edit', params: { id: item.id } }),
            },
            {
              label: tc('actions.delete'),
              danger: true,
              hidden: !!item.role?.isAdmin || !hasPermission('users', 'delete'),
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
