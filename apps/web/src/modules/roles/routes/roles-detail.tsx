import {
  useGetPermissionsResourcesSuspense,
  useGetRolesIdPermissionsSuspense,
  useGetRolesIdSuspense,
} from '@helix/api-client/hooks'
import type { PermissionAction } from '@helix/api-client/types'
import {
  Alert,
  Button,
  Grid,
  IconLock,
  IconPencil,
  LabeledValue,
  PageView,
  Stack,
  Text,
  Title,
} from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { formatDate } from '@/utils/date'

import { HasPermission } from '../../auth/components/has-permission'
import { hasPagePermission } from '../../auth/page-access'
import { useAuth } from '../../auth/use-auth'
import { PermissionsTree } from '../components/permissions-tree'
import { rolesDetailRoute } from '.'
import { ROLES_ACCESS } from './access'

export function RolesDetail() {
  const { id } = rolesDetailRoute.useParams()
  const navigate = rolesDetailRoute.useNavigate()
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')
  const { hasPermission } = useAuth()

  const { data: item } = useGetRolesIdSuspense(id)

  return (
    <PageView
      title={item.name}
      description={item.description}
      actions={
        // The admin role is locked for everyone (API: admin_role_locked)
        !item.isAdmin && (
          <>
            {hasPagePermission(ROLES_ACCESS.permissions, hasPermission) && (
              <Button
                variant="default"
                onClick={() =>
                  navigate({ to: '/roles/$id/permissions', params: { id } })
                }
              >
                {t('permissions.editButton')}
              </Button>
            )}
            <HasPermission resource="roles" action="edit">
              <Button
                leftSection={<IconPencil size={17} />}
                onClick={() =>
                  navigate({ to: '/roles/$id/edit', params: { id } })
                }
              >
                {tc('actions.edit')}
              </Button>
            </HasPermission>
          </>
        )
      }
    >
      <Grid gap="lg">
        {item.isAdmin && (
          <Grid.Col span={12}>
            <Alert icon={<IconLock size={16} />} title={t('admin.title')}>
              {t('admin.description')}
            </Alert>
          </Grid.Col>
        )}
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.isDefault')}>
            <Text size="md">
              {item.isDefault ? t('labels.yes') : t('labels.no')}
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
        <HasPermission resource="permissions" action="view">
          <Grid.Col span={12}>
            <RoleGrants roleId={id} />
          </Grid.Col>
        </HasPermission>
      </Grid>
    </PageView>
  )
}

interface RoleGrantsProps {
  roleId: string
}

/**
 * The role's grants, read-only. Its own component so the queries run only for
 * a user with `permissions:view` — `GET /roles/:id/permissions` answers 403
 * to anyone else, who sees the role without this section.
 */
function RoleGrants(props: Readonly<RoleGrantsProps>) {
  const { roleId } = props

  const { t } = useTranslation('roles')
  const { data: grants } = useGetRolesIdPermissionsSuspense(roleId)
  const { data: definitions } = useGetPermissionsResourcesSuspense()

  return (
    <Stack gap="sm">
      <Title order={2} size="h3">
        {t('permissions.title')}
      </Title>
      <PermissionsTree
        definitions={definitions}
        grants={grants.grants as Record<string, PermissionAction[]>}
        onChange={() => {}}
        disabled
      />
    </Stack>
  )
}
