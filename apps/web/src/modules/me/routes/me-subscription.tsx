import {
  Alert,
  Center,
  DetailList,
  FormSection,
  IconAlertTriangle,
  Loader,
  StatusBadge,
} from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { SUBSCRIPTION_STATUS_TONES } from '@/modules/subscriptions/constants'
import { formatDate } from '@/utils/date'

import { PlanCatalog } from '../../subscriptions/components/plan-catalog'
import { useSubscription } from '../../subscriptions/hooks/use-subscription'
import { useSubscriptionAccess } from '../../subscriptions/hooks/use-subscription-access'

export function MeSubscription() {
  const { subscription, plan, plans, isPending } = useSubscription()
  const { graceEndsAt, isPending: accessPending } = useSubscriptionAccess()
  const { t } = useTranslation('subscription')

  // The catalog doubles as the "change plan" path until a checkout exists:
  // products with a payment flow add their call to action here.
  const planCatalog =
    plans.length > 0 ? (
      <FormSection
        title={t('plans.title')}
        description={t('plans.description')}
      >
        <PlanCatalog plans={plans} currentPlanId={subscription?.planId} />
      </FormSection>
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
      <>
        <FormSection
          title={t('me.noSubscription.title')}
          description={t('me.noSubscription.description')}
        />
        {planCatalog}
      </>
    )
  }

  const date = (value: string) => formatDate(parseISO(value), 'short')

  return (
    <>
      <FormSection title={t('me.title')} description={t('me.description')}>
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
        <DetailList
          items={[
            {
              label: t('me.labels.plan'),
              value: plan?.name ?? subscription.planId,
            },
            {
              label: t('me.labels.status'),
              value: (
                <StatusBadge
                  tone={SUBSCRIPTION_STATUS_TONES[subscription.status]}
                >
                  {t(`status.${subscription.status}`)}
                </StatusBadge>
              ),
            },
            {
              label: t('me.labels.trialEnds'),
              value: subscription.trialEndsAt
                ? date(subscription.trialEndsAt)
                : null,
              hidden: !subscription.trialEndsAt,
            },
            {
              label: t('me.labels.periodStart'),
              value: date(subscription.currentPeriodStart),
            },
            {
              label: t('me.labels.periodEnd'),
              value: date(subscription.currentPeriodEnd),
            },
          ]}
        />
      </FormSection>

      {planCatalog}
    </>
  )
}
