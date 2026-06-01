import {
  useGetPermissionsResourcesSuspense,
  useGetRolesIdPermissionsSuspense,
  useGetRolesIdSuspense,
} from '@helix/api-client/hooks'
import type { PermissionAction } from '@helix/api-client/types'
import {
  Button,
  Grid,
  Group,
  LabeledValue,
  PageView,
  Stack,
  Text,
  Title,
} from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { formatDate } from '@/utils/date'

import { useAuth } from '../../auth/use-auth'
import { PermissionsTree } from '../components/permissions-tree'
import { rolesDetailRoute } from '.'

export function RolesDetail() {
  const { id } = rolesDetailRoute.useParams()
  const navigate = rolesDetailRoute.useNavigate()
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')
  const { hasPermission } = useAuth()

  const { data: item } = useGetRolesIdSuspense(id)
  const { data: grants } = useGetRolesIdPermissionsSuspense(id)
  const { data: definitions } = useGetPermissionsResourcesSuspense()

  return (
    <PageView
      title={t('detail.title')}
      actions={
        <Group justify="flex-end">
          {hasPermission('permissions', 'edit') && (
            <Button
              variant="default"
              onClick={() =>
                navigate({ to: '/roles/$id/permissions', params: { id } })
              }
            >
              {t('permissions.editButton')}
            </Button>
          )}
        </Group>
      }
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

        <Grid.Col span={12}>
          <Stack gap="sm">
            <Title order={3}>{t('permissions.title')}</Title>

            <PermissionsTree
              definitions={definitions}
              grants={grants.grants as Record<string, PermissionAction[]>}
              onChange={() => {}}
              disabled
            />
          </Stack>
        </Grid.Col>
      </Grid>
    </PageView>
  )
}
