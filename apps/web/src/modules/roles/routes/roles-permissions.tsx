import { PageEdit } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import { PermissionsEditor } from '../components/permissions-editor'
import { rolesPermissionsRoute } from '.'

export function RolesPermissions() {
  const { id } = rolesPermissionsRoute.useParams()
  const navigate = rolesPermissionsRoute.useNavigate()
  const { t } = useTranslation('roles')

  return (
    <PageEdit title={t('permissions.editTitle')}>
      <PermissionsEditor
        roleId={id}
        onCancel={() => navigate({ to: '/roles/$id', params: { id } })}
      />
    </PageEdit>
  )
}
