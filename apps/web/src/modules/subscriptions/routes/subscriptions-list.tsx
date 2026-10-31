import {
  deleteSubscriptionsId,
  getSubscriptionsIdSuspenseQueryKey,
  getSubscriptionsSuspenseQueryKey,
  useGetSubscriptionsSuspense,
} from '@helix/api-client/hooks'
import {
  Badge,
  Button,
  confirm,
  DataTable,
  type DataTableColumn,
  EmptyState,
  getDataTablePaginationProps,
  getDataTableSortingProps,
  Group,
  IconPlus,
  notify,
  PageList,
} from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { HasPermission } from '../../auth/components/has-permission'
import { SUBSCRIPTION_STATUS_COLORS } from '../constants'
import { useSubscription } from '../hooks/use-subscription'
import type { SubscriptionItem } from '../types'
import { subscriptionsListRoute } from '.'

export function SubscriptionsList() {
  const queryClient = useQueryClient()
  const navigate = subscriptionsListRoute.useNavigate()
  const search = subscriptionsListRoute.useSearch()
  const { page, pageSize, sortBy, sortOrder } = search
  const { t } = useTranslation('subscription')
  const { t: tc } = useTranslation('common')
  const { getPlanName } = useSubscription()

  const { data: subscriptionsResponse } = useGetSubscriptionsSuspense({
    page,
    pageSize,
    sortBy,
    sortOrder,
  })

  const paginationProps = getDataTablePaginationProps(
    subscriptionsResponse,
    search,
    navigate
  )
  const sortingProps = getDataTableSortingProps(search, navigate)

  const { mutate: deleteSubscription } = useMutation({
    mutationFn: (id: string) => deleteSubscriptionsId(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: getSubscriptionsSuspenseQueryKey(),
        exact: true,
      })
      queryClient.removeQueries({
        queryKey: getSubscriptionsIdSuspenseQueryKey(id),
      })
    },
    onError: () => {
      notify({ status: 'danger', message: t('notifications.deleteFailed') })
    },
  })

  const handleDelete = (id: string) => {
    confirm({
      status: 'danger',
      title: t('delete.title'),
      message: t('delete.message'),
      confirmLabel: tc('actions.delete'),
      onConfirm: () =>
        deleteSubscription(id, {
          onSuccess: () =>
            notify({ status: 'success', message: t('notifications.deleted') }),
        }),
    })
  }

  const columns: DataTableColumn<SubscriptionItem>[] = [
    { accessor: 'userId', title: t('columns.userId'), width: '20%' },
    {
      accessor: 'planId',
      title: t('columns.planId'),
      sortable: true,
      render: (item) => getPlanName(item.planId),
    },
    {
      accessor: 'status',
      title: t('columns.status'),
      sortable: true,
      render: (item) => (
        <Badge color={SUBSCRIPTION_STATUS_COLORS[item.status]} variant="light">
          {t(`status.${item.status}`)}
        </Badge>
      ),
    },
    {
      accessor: 'currentPeriodEnd',
      title: t('columns.currentPeriodEnd'),
      sortable: true,
      render: (item) => new Date(item.currentPeriodEnd).toLocaleDateString(),
    },
    {
      accessor: 'actions',
      title: t('columns.actions'),
      textAlign: 'center',
      width: '1%',
      render: (item) => (
        <Group justify="center" gap="xs" wrap="nowrap">
          <Button
            size="xs"
            variant="default"
            aria-label="View"
            onClick={() =>
              navigate({
                to: '/subscriptions/$id',
                params: { id: item.id },
              })
            }
          >
            {tc('actions.view')}
          </Button>
          <HasPermission resource="subscriptions" action="edit">
            <Button
              size="xs"
              variant="default"
              aria-label="Edit"
              onClick={() =>
                navigate({
                  to: '/subscriptions/$id/edit',
                  params: { id: item.id },
                })
              }
            >
              {tc('actions.edit')}
            </Button>
          </HasPermission>
          <HasPermission resource="subscriptions" action="delete">
            <Button
              size="xs"
              variant="default"
              aria-label="Delete"
              onClick={() => handleDelete(item.id)}
            >
              {tc('actions.delete')}
            </Button>
          </HasPermission>
        </Group>
      ),
    },
  ]

  if (subscriptionsResponse.data.length === 0) {
    return (
      <EmptyState title={t('empty.title')} description={t('empty.description')}>
        <HasPermission resource="subscriptions" action="create">
          <Button
            size="lg"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/subscriptions/create' })}
          >
            {t('empty.createButton')}
          </Button>
        </HasPermission>
      </EmptyState>
    )
  }

  return (
    <PageList
      title={t('title')}
      actions={
        <HasPermission resource="subscriptions" action="create">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/subscriptions/create' })}
          >
            {tc('actions.create')}
          </Button>
        </HasPermission>
      }
    >
      <DataTable
        records={subscriptionsResponse.data}
        columns={columns}
        {...paginationProps}
        {...sortingProps}
      />
    </PageList>
  )
}
