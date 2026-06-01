import { useGetSubscriptionsIdSuspense } from '@helix/api-client/hooks'
import { Badge, Button, Group, LabeledValue, PageView, Stack } from '@helix/ui'
import { formatDate, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { SUBSCRIPTION_STATUS_COLORS } from '../constants'
import { subscriptionsDetailRoute, subscriptionsListRoute } from '.'

export function SubscriptionsDetail() {
  const { id } = subscriptionsDetailRoute.useParams()
  const navigate = subscriptionsListRoute.useNavigate()
  const { t } = useTranslation('subscription')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetSubscriptionsIdSuspense(id)

  const statusColor = SUBSCRIPTION_STATUS_COLORS[item.status]

  return (
    <PageView
      title={t('detail.title')}
      footerActions={
        <Group>
          <Button
            size="md"
            variant="default"
            onClick={() => navigate({ to: '/subscriptions' })}
          >
            {tc('actions.back')}
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <LabeledValue label={t('labels.userId')}>{item.userId}</LabeledValue>

        <LabeledValue label={t('labels.planId')}>{item.planId}</LabeledValue>

        <LabeledValue label={t('labels.status')}>
          <Badge color={statusColor} variant="light">
            {t(`status.${item.status}`)}
          </Badge>
        </LabeledValue>

        <LabeledValue label={t('labels.currentPeriodStart')}>
          {formatDate(parseISO(item.currentPeriodStart), 'short')}
        </LabeledValue>

        <LabeledValue label={t('labels.currentPeriodEnd')}>
          {formatDate(parseISO(item.currentPeriodEnd), 'short')}
        </LabeledValue>

        {item.trialEndsAt && (
          <LabeledValue label={t('labels.trialEndsAt')}>
            {formatDate(parseISO(item.trialEndsAt), 'short')}
          </LabeledValue>
        )}

        {item.canceledAt && (
          <LabeledValue label={t('labels.canceledAt')}>
            {formatDate(parseISO(item.canceledAt), 'short')}
          </LabeledValue>
        )}

        {item.externalId && (
          <LabeledValue label={t('labels.externalId')}>
            {item.externalId}
          </LabeledValue>
        )}

        <LabeledValue label={t('labels.createdAt')}>
          {formatDate(parseISO(item.createdAt), 'short')}
        </LabeledValue>
      </Stack>
    </PageView>
  )
}
