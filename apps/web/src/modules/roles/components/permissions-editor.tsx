import {
  getRolesIdPermissionsSuspenseQueryKey,
  putRolesIdPermissions,
  useGetPermissionsResourcesSuspense,
  useGetRolesIdPermissionsSuspense,
} from '@helix/api-client/hooks'
import type { Grants, PermissionAction } from '@helix/api-client/types'
import { Button, Divider, Group, notify } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PermissionsTree } from './permissions-tree'

export interface PermissionsEditorProps {
  roleId: string
  onCancel: () => void
}

export function PermissionsEditor(props: Readonly<PermissionsEditorProps>) {
  const { roleId, onCancel } = props

  const queryClient = useQueryClient()
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')
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
      notify({
        status: 'success',
        message: t('permissions.notifications.saved'),
      })
    },
    onError: () => {
      notify({
        status: 'danger',
        message: t('permissions.notifications.saveFailed'),
      })
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
      <Divider my="xl" />
      <Group justify="flex-end">
        <Button
          size="md"
          variant="default"
          disabled={isPending}
          onClick={onCancel}
        >
          {tc('actions.cancel')}
        </Button>
        <Button size="md" loading={isPending} onClick={handleSave}>
          {tc('actions.save')}
        </Button>
      </Group>
    </>
  )
}
