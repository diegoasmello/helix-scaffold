import { useGetSubscriptionsIdSuspense } from '@helix/api-client/hooks'
import {
  Button,
  DetailList,
  IconPencil,
  PageSection,
  PageView,
  StatusBadge,
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
      <PageSection title={t('sections.details')}>
        <DetailList
          items={[
            { label: t('labels.userId'), value: item.userId },
            {
              label: t('labels.currentPeriodStart'),
              value: date(item.currentPeriodStart),
            },
            {
              label: t('labels.currentPeriodEnd'),
              value: date(item.currentPeriodEnd),
            },
            {
              label: t('labels.trialEndsAt'),
              value: date(item.trialEndsAt),
              hidden: !item.trialEndsAt,
            },
            {
              label: t('labels.pastDueSince'),
              value: date(item.pastDueSince),
              hidden: !item.pastDueSince,
            },
            {
              label: t('labels.canceledAt'),
              value: date(item.canceledAt),
              hidden: !item.canceledAt,
            },
            {
              label: t('labels.externalId'),
              value: item.externalId,
              hidden: !item.externalId,
            },
            { label: t('labels.createdAt'), value: date(item.createdAt) },
          ]}
        />
      </PageSection>
    </PageView>
  )
}
