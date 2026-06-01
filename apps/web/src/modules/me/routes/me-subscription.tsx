import {
  Badge,
  Center,
  LabeledValue,
  Loader,
  Stack,
  Text,
  Title,
} from '@helix/ui'
import { formatDate, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { SUBSCRIPTION_STATUS_COLORS } from '@/modules/subscriptions/constants'

import { useSubscription } from '../../subscriptions/hooks/use-subscription'

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

  const statusColor = SUBSCRIPTION_STATUS_COLORS[subscription.status]

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
          <LabeledValue label={t('me.labels.plan')}>
            {subscription.planId}
          </LabeledValue>

          <LabeledValue label={t('me.labels.status')}>
            <Badge color={statusColor} variant="light">
              {t(`status.${subscription.status}`)}
            </Badge>
          </LabeledValue>

          {subscription.trialEndsAt && (
            <LabeledValue label={t('me.labels.trialEnds')}>
              {formatDate(parseISO(subscription.trialEndsAt), 'short')}
            </LabeledValue>
          )}

          <LabeledValue label={t('me.labels.periodStart')}>
            {formatDate(parseISO(subscription.currentPeriodStart), 'short')}
          </LabeledValue>

          <LabeledValue label={t('me.labels.periodEnd')}>
            {formatDate(parseISO(subscription.currentPeriodEnd), 'short')}
          </LabeledValue>
        </Stack>
      </Stack>
    </Stack>
  )
}
