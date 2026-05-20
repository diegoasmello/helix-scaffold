import {
  getRolesIdPermissionsSuspenseQueryKey,
  putRolesIdPermissions,
  useGetPermissionsResourcesSuspense,
  useGetRolesIdPermissionsSuspense,
} from '@helix/api-client/hooks'
import type { Grants, PermissionAction } from '@helix/api-client/types'
import { Button, Divider, Group, notify, Paper } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { PermissionsTree } from './permissions-tree'

export interface PermissionsEditorProps {
  roleId: string
  onCancel: () => void
}

export function PermissionsEditor(props: Readonly<PermissionsEditorProps>) {
  const { roleId, onCancel } = props

  const queryClient = useQueryClient()
  const { data: saved } = useGetRolesIdPermissionsSuspense(roleId)
  const { data: definitions } = useGetPermissionsResourcesSuspense()

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
    <Paper p="24">
      <PermissionsTree
        definitions={definitions}
        grants={grants as Record<string, PermissionAction[]>}
        onChange={setGrants}
      />
      <Divider my="xl" />
      <Group justify="flex-end">
        <Button
          size="md"
          variant="secondary"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="md"
          type="submit"
          loading={isPending}
          onClick={handleSave}
        >
          Save
        </Button>
      </Group>
    </Paper>
  )
}
