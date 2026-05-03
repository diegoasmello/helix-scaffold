import { useGetRolesAllSuspense } from '@helix/api-client/hooks'
import { Center, Loader, PageList, Select, Text } from '@helix/ui'
import { Suspense, useState } from 'react'

import { PermissionsEditor } from '../components/permissions-editor'

export function Permissions() {
  const { data: roles } = useGetRolesAllSuspense()
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  return (
    <PageList
      title="Permissions"
      actions={
        <Select
          placeholder="Select a role"
          data={roles.map((r) => ({ value: r.id, label: r.name }))}
          value={selectedRoleId}
          onChange={setSelectedRoleId}
          w={200}
        />
      }
    >
      {selectedRoleId ? (
        <Suspense
          fallback={
            <Center h={200}>
              <Loader />
            </Center>
          }
        >
          <PermissionsEditor roleId={selectedRoleId} key={selectedRoleId} />
        </Suspense>
      ) : (
        <Center h={200}>
          <Text c="dimmed" size="sm">
            Select a role to configure its permissions.
          </Text>
        </Center>
      )}
    </PageList>
  )
}
