import { useGetRolesAllSuspense } from '@helix/api-client/hooks'
import { Flex, PageList, Paper, Select, Text } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import { permissionsRoute } from '../routes'

export function Permissions() {
  const { data: roles } = useGetRolesAllSuspense()
  const navigate = permissionsRoute.useNavigate()
  const { t } = useTranslation('permissions')

  return (
    <PageList title={t('title')}>
      <Paper p="24">
        <Flex direction="column" align="center" gap="md">
          <Text c="dimmed" size="sm">
            {t('selectRoleDescription')}
          </Text>
          <Select
            placeholder={t('selectRolePlaceholder')}
            data={roles.map((r) => ({ value: r.id, label: r.name }))}
            onChange={(roleId) => {
              if (roleId) {
                navigate({
                  to: '/permissions/edit/$roleId',
                  params: { roleId },
                })
              }
            }}
          />
        </Flex>
      </Paper>
    </PageList>
  )
}
