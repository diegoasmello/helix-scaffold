import { PageList } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import { PermissionsEditor } from '../components/permissions-editor'
import { permissionsEditRoute } from '../routes'

export function PermissionsEdit() {
  const { roleId } = permissionsEditRoute.useParams()
  const navigate = permissionsEditRoute.useNavigate()
  const { t } = useTranslation('permissions')

  return (
    <PageList title={t('editTitle')}>
      <PermissionsEditor
        roleId={roleId}
        onCancel={() => navigate({ to: '/permissions' })}
      />
    </PageList>
  )
}
