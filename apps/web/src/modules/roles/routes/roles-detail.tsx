import { useGetRolesIdSuspense } from '@helix/api-client/hooks'
import { Button, Grid, Group, LabeledValue, PageView, Text } from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { formatDate } from '@/utils/date'

import { rolesDetailRoute } from '.'

export function RolesDetail() {
  const { id } = rolesDetailRoute.useParams()
  const navigate = rolesDetailRoute.useNavigate()
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetRolesIdSuspense(id)

  return (
    <PageView
      title={t('detail.title')}
      footerActions={
        <Group justify="flex-end">
          <Button
            size="md"
            variant="default"
            onClick={() => navigate({ to: '/roles' })}
          >
            {tc('actions.back')}
          </Button>
        </Group>
      }
    >
      <Grid>
        <Grid.Col span={12}>
          <LabeledValue label={t('labels.name')}>
            <Text size="md">{item.name}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={12}>
          <LabeledValue label={t('labels.description')}>
            <Text size="md">{item.description}</Text>
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
