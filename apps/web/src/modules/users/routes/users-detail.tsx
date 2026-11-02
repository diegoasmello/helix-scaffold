import { useGetUsersIdSuspense } from '@helix/api-client/hooks'
import {
  Button,
  DetailList,
  IconPencil,
  PageSection,
  PageView,
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
        <HasPermission resource="users" action="edit">
          <Button
            leftSection={<IconPencil size={17} />}
            onClick={() => navigate({ to: '/users/$id/edit', params: { id } })}
          >
            {tc('actions.edit')}
          </Button>
        </HasPermission>
      }
    >
      <PageSection title={t('sections.details')}>
        <DetailList
          items={[
            { label: t('labels.role'), value: item.role?.name },
            {
              label: t('labels.emailVerified'),
              value: item.emailVerified ? t('labels.yes') : t('labels.no'),
            },
            {
              label: t('labels.createdAt'),
              value: formatDate(parseISO(item.createdAt), 'short'),
            },
          ]}
        />
      </PageSection>
    </PageView>
  )
}
