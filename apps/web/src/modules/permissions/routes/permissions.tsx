import { useGetRolesAllSuspense } from '@helix/api-client/hooks'
import { Flex, PageList, Paper, Select, Text } from '@helix/ui'

import { permissionsRoute } from '../routes'

export function Permissions() {
  const { data: roles } = useGetRolesAllSuspense()
  const navigate = permissionsRoute.useNavigate()

  return (
    <PageList title="Permissions">
      <Paper p="24">
        <Flex direction="column" align="center" gap="md">
          <Text c="dimmed" size="sm">
            Select a role to configure its permissions.
          </Text>
          <Select
            placeholder="Select a role"
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
