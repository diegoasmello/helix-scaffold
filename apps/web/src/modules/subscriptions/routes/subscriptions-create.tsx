import { postSubscriptions } from '@helix/api-client/hooks'
import { Button, Form, notify, PageCreate, useForm } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/lib/api-errors'
import { useResourceCache } from '@/lib/resource-cache'

import { SubscriptionsForm } from '../components/subscriptions-form'
import { useSubscription } from '../hooks/use-subscription'
import type { SubscriptionFormValues } from '../types'
import { subscriptionFormValidate } from '../validation'
import { subscriptionsListRoute } from '.'

export function SubscriptionsCreate() {
  const navigate = subscriptionsListRoute.useNavigate()
  const resourceCache = useResourceCache()
  const { t } = useTranslation('subscription')
  const { t: tc } = useTranslation('common')
  const { plans } = useSubscription()

  const form = useForm<SubscriptionFormValues>({
    initialValues: {
      userId: '',
      planId: '',
      status: 'active',
      currentPeriodStart: new Date().toISOString().split('T')[0],
      currentPeriodEnd: new Date(
        new Date().getTime() + 30 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0],
      trialEndsAt: null,
      externalId: '',
    },
    validate: subscriptionFormValidate,
  })

  const { mutate: createSubscription, isPending } = useMutation({
    mutationFn: (data: SubscriptionFormValues) =>
      postSubscriptions({
        userId: data.userId,
        planId: data.planId,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        trialEndsAt: data.trialEndsAt,
        externalId: data.externalId || undefined,
      }),
    onSuccess: () => {
      void resourceCache.changed('subscriptions')
    },
  })

  const handleSubmit = (values: SubscriptionFormValues) => {
    createSubscription(values, {
      onSuccess: () => {
        notify({ status: 'success', message: t('notifications.created') })
        navigate({ to: '/subscriptions' })
      },
      onError: (error) => {
        notify({
          status: 'danger',
          message: apiErrorMessage(
            error,
            'subscription',
            'notifications.createFailed'
          ),
        })
      },
    })
  }

  return (
    <Form<SubscriptionFormValues> form={form} onSubmit={handleSubmit}>
      <PageCreate
        title={t('create.title')}
        footerActions={
          <>
            <Button
              size="md"
              variant="default"
              type="button"
              disabled={isPending}
              onClick={() => navigate({ to: '/subscriptions' })}
            >
              {tc('actions.cancel')}
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              {tc('actions.save')}
            </Button>
          </>
        }
      >
        <SubscriptionsForm form={form} plans={plans} />
      </PageCreate>
    </Form>
  )
}
