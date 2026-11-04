import { useGetUsersIdSuspense } from '@helix/api-client/hooks'
import {
  Button,
  Grid,
  IconPencil,
  LabeledValue,
  PageView,
  Text,
} from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { formatDate } from '@/utils/date'

import { HasPermission } from '../../auth/components/has-permission'
import { usersDetailRoute } from '.'

export function UsersDetail() {
  const { id } = usersDetailRoute.useParams()
  const navigate = usersDetailRoute.useNavigate()
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetUsersIdSuspense(id)

  return (
    <PageView
      title={item.name}
      description={item.email}
      actions={
        // The admin account is locked here (API: admin_user_locked)
        !item.role?.isAdmin && (
          <HasPermission resource="users" action="edit">
            <Button
              leftSection={<IconPencil size={17} />}
              onClick={() =>
                navigate({ to: '/users/$id/edit', params: { id } })
              }
            >
              {tc('actions.edit')}
            </Button>
          </HasPermission>
        )
      }
    >
      <Grid gap="lg">
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
