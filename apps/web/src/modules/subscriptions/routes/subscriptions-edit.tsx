import {
  getSubscriptionsIdSuspenseQueryKey,
  getSubscriptionsSuspenseQueryKey,
  patchSubscriptionsId,
  useGetSubscriptionsIdSuspense,
} from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageEdit, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { SubscriptionsForm } from '../components/subscriptions-form'
import type { SubscriptionFormValues } from '../types'
import { subscriptionFormValidate } from '../validation'
import { subscriptionsEditRoute, subscriptionsListRoute } from '.'

export function SubscriptionsEdit() {
  const { id } = subscriptionsEditRoute.useParams()
  const navigate = subscriptionsListRoute.useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation('subscription')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetSubscriptionsIdSuspense(id)

  const form = useForm<SubscriptionFormValues>({
    initialValues: {
      userId: item.userId,
      planId: item.planId,
      status: item.status,
      currentPeriodStart: item.currentPeriodStart.split('T')[0],
      currentPeriodEnd: item.currentPeriodEnd.split('T')[0],
      trialEndsAt: item.trialEndsAt ? item.trialEndsAt.split('T')[0] : null,
      externalId: item.externalId ?? '',
    },
    validate: subscriptionFormValidate,
  })

  const { mutate: updateSubscription, isPending } = useMutation({
    mutationFn: (data: SubscriptionFormValues) =>
      patchSubscriptionsId(id, {
        planId: data.planId,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        trialEndsAt: data.trialEndsAt ?? null,
        externalId: data.externalId || null,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: getSubscriptionsSuspenseQueryKey(),
        exact: true,
      })
      queryClient.setQueryData(getSubscriptionsIdSuspenseQueryKey(id), updated)
    },
  })

  const handleSubmit = (values: SubscriptionFormValues) => {
    updateSubscription(values, {
      onSuccess: () => {
        notify({ status: 'success', message: t('notifications.updated') })
        navigate({ to: '/subscriptions' })
      },
      onError: () => {
        notify({ status: 'danger', message: t('notifications.updateFailed') })
      },
    })
  }

  return (
    <Form<SubscriptionFormValues> form={form} onSubmit={handleSubmit}>
      <PageEdit
        title={t('edit.title')}
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
        <SubscriptionsForm form={form} isEditing />
      </PageEdit>
    </Form>
  )
}
