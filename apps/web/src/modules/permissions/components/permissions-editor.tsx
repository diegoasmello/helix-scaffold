import {
  getRolesIdPermissionsSuspenseQueryKey,
  putRolesIdPermissions,
  useGetPermissionsResourcesSuspense,
  useGetRolesIdPermissionsSuspense,
} from '@helix/api-client/hooks'
import type { Grants, PermissionAction } from '@helix/api-client/types'
import { Button, Group, notify } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { PermissionsTree } from './permissions-tree'

export interface PermissionsEditorProps {
  roleId: string
}

export function PermissionsEditor(props: Readonly<PermissionsEditorProps>) {
  const { roleId } = props
  const { data: saved } = useGetRolesIdPermissionsSuspense(roleId)
  const { data: definitions } = useGetPermissionsResourcesSuspense()
  const queryClient = useQueryClient()
  const { mutate: updatePermissions, isPending } = useMutation({
    mutationFn: ({ roleId, grants }: { roleId: string; grants: Grants }) =>
      putRolesIdPermissions(roleId, { grants }),
    onSuccess: (updated, { roleId }) => {
      queryClient.setQueryData(
        getRolesIdPermissionsSuspenseQueryKey(roleId),
        updated
      )
      notify({ status: 'success', message: 'Permissions saved successfully' })
    },
    onError: () => {
      notify({ status: 'danger', message: 'Failed to save permissions' })
    },
  })
  const [grants, setGrants] = useState<Grants>(saved.grants)

  const handleSave = () => {
    updatePermissions({ roleId, grants })
  }

  return (
    <>
      <PermissionsTree
        definitions={definitions}
        grants={grants as Record<string, PermissionAction[]>}
        onChange={setGrants}
      />
      <Group justify="flex-end" mt="lg">
        <Button loading={isPending} onClick={handleSave}>
          Save
        </Button>
      </Group>
    </>
  )
}
