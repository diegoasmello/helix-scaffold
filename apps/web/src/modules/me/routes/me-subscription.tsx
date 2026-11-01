import {
  Alert,
  Badge,
  Center,
  IconAlertTriangle,
  LabeledValue,
  Loader,
  Stack,
  Text,
  Title,
} from '@helix/ui'
import { parseISO } from 'date-fns'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { SUBSCRIPTION_STATUS_COLORS } from '@/modules/subscriptions/constants'
import { formatDate } from '@/utils/date'

import { PlanCatalog } from '../../subscriptions/components/plan-catalog'
import { useSubscription } from '../../subscriptions/hooks/use-subscription'
import { useSubscriptionAccess } from '../../subscriptions/hooks/use-subscription-access'

export function MeSubscription() {
  const { subscription, plan, plans, isPending } = useSubscription()
  const { graceEndsAt, isPending: accessPending } = useSubscriptionAccess()
  const { t } = useTranslation('subscription')
  const plansHeadingId = useId()

  // The catalog doubles as the "change plan" path until a checkout exists:
  // products with a payment flow add their call to action here.
  const planCatalog =
    plans.length > 0 ? (
      <Stack component="section" aria-labelledby={plansHeadingId} gap="md">
        <Stack gap={4}>
          <Title id={plansHeadingId} order={5} lh={1.2}>
            {t('plans.title')}
          </Title>
          <Text c="dimmed" size="xs">
            {t('plans.description')}
          </Text>
        </Stack>
        <PlanCatalog plans={plans} currentPlanId={subscription?.planId} />
      </Stack>
    ) : null

  if (isPending || accessPending) {
    return (
      <Center h={120}>
        <Loader size="sm" />
      </Center>
    )
  }

  if (!subscription) {
    return (
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={4}>{t('me.noSubscription.title')}</Title>
          <Text c="dimmed" size="sm">
            {t('me.noSubscription.description')}
          </Text>
        </Stack>
        {planCatalog}
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

        {graceEndsAt && (
          <Alert
            color="orange"
            icon={<IconAlertTriangle size={16} />}
            title={t('me.pastDue.title')}
          >
            {t('me.pastDue.description', {
              date: formatDate(graceEndsAt, 'long'),
            })}
          </Alert>
        )}

        <Stack gap="xs">
          <LabeledValue label={t('me.labels.plan')}>
            {plan?.name ?? subscription.planId}
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

      {planCatalog}
    </Stack>
  )
}
