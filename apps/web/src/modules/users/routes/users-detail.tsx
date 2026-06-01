import { useGetUsersIdSuspense } from '@helix/api-client/hooks'
import { Button, Grid, Group, LabeledValue, PageView, Text } from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { formatDate } from '@/utils/date'

import { usersDetailRoute } from '.'

export function UsersDetail() {
  const { id } = usersDetailRoute.useParams()
  const navigate = usersDetailRoute.useNavigate()
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetUsersIdSuspense(id)

  return (
    <PageView
      title={t('detail.title')}
      footerActions={
        <Group justify="flex-end">
          <Button
            size="md"
            variant="default"
            onClick={() => navigate({ to: '/users' })}
          >
            {tc('actions.back')}
          </Button>
        </Group>
      }
    >
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.name')}>
            <Text size="md">{item.name}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.email')}>
            <Text size="md">{item.email}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.role')}>
            <Text size="md">{item.role?.name ?? '—'}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.emailVerified')}>
            <Text size="md">
              {item.emailVerified ? t('labels.yes') : t('labels.no')}
            </Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.createdAt')}>
            <Text size="md">
              {formatDate(parseISO(item.createdAt), 'short')}
            </Text>
          </LabeledValue>
        </Grid.Col>
      </Grid>
    </PageView>
  )
}
