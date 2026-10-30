import {
  getSubscriptionsSuspenseQueryKey,
  postSubscriptions,
} from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageCreate, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { SubscriptionsForm } from '../components/subscriptions-form'
import type { SubscriptionFormValues } from '../types'
import { subscriptionFormValidate } from '../validation'
import { subscriptionsListRoute } from '.'

export function SubscriptionsCreate() {
  const navigate = subscriptionsListRoute.useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation('subscription')
  const { t: tc } = useTranslation('common')

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
      queryClient.invalidateQueries({
        queryKey: getSubscriptionsSuspenseQueryKey(),
        exact: true,
      })
    },
  })

  const handleSubmit = (values: SubscriptionFormValues) => {
    createSubscription(values, {
      onSuccess: () => {
        notify({ status: 'success', message: t('notifications.created') })
        navigate({ to: '/subscriptions' })
      },
      onError: () => {
        notify({ status: 'danger', message: t('notifications.createFailed') })
      },
    })
  }

  return (
    <Form<SubscriptionFormValues> form={form} onSubmit={handleSubmit}>
      <PageCreate
        title={t('create.title')}
        footerActions={
          <Group justify="flex-end">
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
          </Group>
        }
      >
        <SubscriptionsForm form={form} />
      </PageCreate>
    </Form>
  )
}
