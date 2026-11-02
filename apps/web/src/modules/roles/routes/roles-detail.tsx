import {
  useGetPermissionsResourcesSuspense,
  useGetRolesIdPermissionsSuspense,
  useGetRolesIdSuspense,
} from '@helix/api-client/hooks'
import type { PermissionAction } from '@helix/api-client/types'
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
import { PermissionsTree } from '../components/permissions-tree'
import { rolesDetailRoute } from '.'

export function RolesDetail() {
  const { id } = rolesDetailRoute.useParams()
  const navigate = rolesDetailRoute.useNavigate()
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetRolesIdSuspense(id)
  const { data: grants } = useGetRolesIdPermissionsSuspense(id)
  const { data: definitions } = useGetPermissionsResourcesSuspense()

  return (
    <PageView
      title={item.name}
      description={item.description}
      actions={
        <>
          <HasPermission resource="permissions" action="edit">
            <Button
              variant="default"
              onClick={() =>
                navigate({ to: '/roles/$id/permissions', params: { id } })
              }
            >
              {t('permissions.editButton')}
            </Button>
          </HasPermission>
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
      }
      aside={
        <PageSection title={t('sections.details')}>
          <DetailList
            items={[
              {
                label: t('labels.isDefault'),
                value: item.isDefault ? t('labels.yes') : t('labels.no'),
              },
              {
                label: t('labels.createdAt'),
                value: formatDate(parseISO(item.createdAt), 'short'),
              },
            ]}
          />
        </PageSection>
      }
    >
      <PageSection title={t('permissions.title')}>
        <PermissionsTree
          definitions={definitions}
          grants={grants.grants as Record<string, PermissionAction[]>}
          onChange={() => {}}
          disabled
        />
      </PageSection>
    </PageView>
  )
}
