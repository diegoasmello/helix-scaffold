import { Badge, Center, Loader, Stack, Text, Title } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import { useSubscription } from '../../subscription/use-subscription'
import type { SubscriptionStatus } from '../../subscriptions/types'

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'green',
  trialing: 'blue',
  canceled: 'gray',
  past_due: 'orange',
  expired: 'red',
}

export function MeSubscription() {
  const { subscription, isPending } = useSubscription()
  const { t } = useTranslation('subscription')

  if (isPending) {
    return (
      <Center h={120}>
        <Loader size="sm" />
      </Center>
    )
  }

  if (!subscription) {
    return (
      <Stack gap="xs">
        <Title order={4}>{t('me.noSubscription.title')}</Title>
        <Text c="dimmed" size="sm">
          {t('me.noSubscription.description')}
        </Text>
      </Stack>
    )
  }

  const statusColor = STATUS_COLORS[subscription.status] ?? 'gray'

  return (
    <Stack gap="xl">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={4} lh={1.2}>
            {t('me.title')}
          </Title>
          <Text c="dimmed" size="xs">
            {t('me.description')}
          </Text>
        </Stack>

        <Stack gap="xs">
          <LabeledValue
            label={t('me.labels.plan')}
            value={subscription.planId}
          />

          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t('me.labels.status')}
            </Text>
            <Badge color={statusColor} variant="light">
              {t(`status.${subscription.status}`)}
            </Badge>
          </Stack>

          {subscription.trialEndsAt && (
            <LabeledValue
              label={t('me.labels.trialEnds')}
              value={new Date(subscription.trialEndsAt).toLocaleDateString()}
            />
          )}

          <LabeledValue
            label={t('me.labels.periodStart')}
            value={new Date(
              subscription.currentPeriodStart
            ).toLocaleDateString()}
          />

          <LabeledValue
            label={t('me.labels.periodEnd')}
            value={new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          />
        </Stack>
      </Stack>
    </Stack>
  )
}

interface LabeledValueProps {
  label: string
  value: string
}

function LabeledValue(props: Readonly<LabeledValueProps>) {
  const { label, value } = props

  return (
    <Stack gap={2}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <Text size="sm" c="dimmed">
        {value}
      </Text>
    </Stack>
  )
}
