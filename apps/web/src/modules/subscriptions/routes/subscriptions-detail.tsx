import { useGetSubscriptionsIdSuspense } from '@helix/api-client/hooks'
import {
  Button,
  Grid,
  IconPencil,
  LabeledValue,
  PageView,
  StatusBadge,
  Text,
} from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { formatDate } from '@/utils/date'

import { HasPermission } from '../../auth/components/has-permission'
import { SUBSCRIPTION_STATUS_TONES } from '../constants'
import { useSubscription } from '../hooks/use-subscription'
import { subscriptionsDetailRoute, subscriptionsListRoute } from '.'

export function SubscriptionsDetail() {
  const { id } = subscriptionsDetailRoute.useParams()
  const navigate = subscriptionsListRoute.useNavigate()
  const { t } = useTranslation('subscription')
  const { t: tc } = useTranslation('common')
  const { getPlanName } = useSubscription()

  const { data: item } = useGetSubscriptionsIdSuspense(id)

  const date = (value: string | null | undefined) =>
    value ? formatDate(parseISO(value), 'short') : null

  // Optional dates and the external id only show when set.
  const fields = [
    { label: t('labels.userId'), value: item.userId },
    {
      label: t('labels.currentPeriodStart'),
      value: date(item.currentPeriodStart),
    },
    { label: t('labels.currentPeriodEnd'), value: date(item.currentPeriodEnd) },
    { label: t('labels.trialEndsAt'), value: date(item.trialEndsAt) },
    { label: t('labels.pastDueSince'), value: date(item.pastDueSince) },
    { label: t('labels.canceledAt'), value: date(item.canceledAt) },
    { label: t('labels.externalId'), value: item.externalId },
    { label: t('labels.createdAt'), value: date(item.createdAt) },
  ]

  return (
    <PageView
      title={getPlanName(item.planId)}
      titleAside={
        <StatusBadge tone={SUBSCRIPTION_STATUS_TONES[item.status]}>
          {t(`status.${item.status}`)}
        </StatusBadge>
      }
      actions={
        <HasPermission resource="subscriptions" action="edit">
          <Button
            leftSection={<IconPencil size={17} />}
            onClick={() =>
              navigate({ to: '/subscriptions/$id/edit', params: { id } })
            }
          >
            {tc('actions.edit')}
          </Button>
        </HasPermission>
      }
    >
      <Grid gap="lg">
        {fields
          .filter((field) => field.value)
          .map((field) => (
            <Grid.Col key={field.label} span={{ base: 12, sm: 6 }}>
              <LabeledValue label={field.label}>
                <Text size="md">{field.value}</Text>
              </LabeledValue>
            </Grid.Col>
          ))}
      </Grid>
    </PageView>
  )
}
