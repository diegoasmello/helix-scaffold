import { useGetSubscriptionsIdSuspense } from '@helix/api-client/hooks'
import { Badge, Button, Group, PageView, Stack, Text } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import type { SubscriptionStatus } from '../types'
import { subscriptionsDetailRoute, subscriptionsListRoute } from '.'

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'green',
  trialing: 'blue',
  canceled: 'gray',
  past_due: 'orange',
  expired: 'red',
}

interface LabeledValueProps {
  label: string
  children: React.ReactNode
}

function LabeledValue(props: Readonly<LabeledValueProps>) {
  const { label, children } = props
  return (
    <Stack gap={2}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <div>{children}</div>
    </Stack>
  )
}

export function SubscriptionsDetail() {
  const { id } = subscriptionsDetailRoute.useParams()
  const navigate = subscriptionsListRoute.useNavigate()
  const { t } = useTranslation('subscription')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetSubscriptionsIdSuspense(id)

  const statusColor = STATUS_COLORS[item.status] ?? 'gray'

  return (
    <PageView
      title={t('detail.title')}
      footerActions={
        <Group>
          <Button
            size="md"
            variant="secondary"
            onClick={() => navigate({ to: '/subscriptions' })}
          >
            {tc('actions.back')}
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <LabeledValue label={t('labels.userId')}>
          <Text size="sm" c="dimmed">
            {item.userId}
          </Text>
        </LabeledValue>

        <LabeledValue label={t('labels.planId')}>
          <Text size="sm" c="dimmed">
            {item.planId}
          </Text>
        </LabeledValue>

        <LabeledValue label={t('labels.status')}>
          <Badge color={statusColor} variant="light">
            {t(`status.${item.status}`)}
          </Badge>
        </LabeledValue>

        <LabeledValue label={t('labels.currentPeriodStart')}>
          <Text size="sm" c="dimmed">
            {new Date(item.currentPeriodStart).toLocaleDateString()}
          </Text>
        </LabeledValue>

        <LabeledValue label={t('labels.currentPeriodEnd')}>
          <Text size="sm" c="dimmed">
            {new Date(item.currentPeriodEnd).toLocaleDateString()}
          </Text>
        </LabeledValue>

        {item.trialEndsAt && (
          <LabeledValue label={t('labels.trialEndsAt')}>
            <Text size="sm" c="dimmed">
              {new Date(item.trialEndsAt).toLocaleDateString()}
            </Text>
          </LabeledValue>
        )}

        {item.canceledAt && (
          <LabeledValue label={t('labels.canceledAt')}>
            <Text size="sm" c="dimmed">
              {new Date(item.canceledAt).toLocaleDateString()}
            </Text>
          </LabeledValue>
        )}

        {item.externalId && (
          <LabeledValue label={t('labels.externalId')}>
            <Text size="sm" c="dimmed">
              {item.externalId}
            </Text>
          </LabeledValue>
        )}

        <LabeledValue label={t('labels.createdAt')}>
          <Text size="sm" c="dimmed">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </LabeledValue>
      </Stack>
    </PageView>
  )
}
