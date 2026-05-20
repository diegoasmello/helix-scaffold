import { PageList } from '@helix/ui'

import { PermissionsEditor } from '../components/permissions-editor'
import { permissionsEditRoute } from '../routes'

export function PermissionsEdit() {
  const { roleId } = permissionsEditRoute.useParams()
  const navigate = permissionsEditRoute.useNavigate()

  return (
    <PageList title="Edit permissions">
      <PermissionsEditor
        roleId={roleId}
        onCancel={() => navigate({ to: '/permissions' })}
      />
    </PageList>
  )
}
