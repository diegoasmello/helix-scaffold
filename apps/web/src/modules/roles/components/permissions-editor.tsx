import {
  getRolesIdPermissionsSuspenseQueryKey,
  putRolesIdPermissions,
  useGetMePermissionsSuspense,
  useGetPermissionsResourcesSuspense,
  useGetRolesIdPermissionsSuspense,
} from '@helix/api-client/hooks'
import type { Grants } from '@helix/api-client/types'
import {
  Alert,
  Button,
  Divider,
  Group,
  IconAlertCircle,
  notify,
  Stack,
  Text,
} from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/lib/api-errors'
import { useResourceCache } from '@/lib/resource-cache'

import { createPermissionChecker } from '../../auth/page-access'
import { ME_PERMISSIONS_STALE_TIME } from '../../auth/use-auth'
import {
  countChanges,
  type EditorGrants,
  grantWithRequirements,
  isGrantable,
  missingRequirements,
  ungrantedActions,
} from '../permission-requirements'
import { PermissionsTree } from './permissions-tree'

export interface PermissionsEditorProps {
  roleId: string
  onCancel: () => void
}

export function PermissionsEditor(props: Readonly<PermissionsEditorProps>) {
  const { roleId, onCancel } = props

  const queryClient = useQueryClient()
  const resourceCache = useResourceCache()
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')
  const { data: saved } = useGetRolesIdPermissionsSuspense(roleId)
  const { data: definitions } = useGetPermissionsResourcesSuspense()
  // The signed-in user's own grants — the cache `useAuth()` reads, loaded by
  // the route guard (same freshness, so no refetch on mount). Suspends rather
  // than render every checkbox disabled while they load. Nobody grants beyond
  // them (privilege ceiling).
  const { data: own } = useGetMePermissionsSuspense({
    query: { staleTime: ME_PERMISSIONS_STALE_TIME },
  })

  const { mutate: updatePermissions, isPending } = useMutation({
    mutationFn: ({ roleId, grants }: { roleId: string; grants: Grants }) =>
      putRolesIdPermissions(roleId, { grants }),
    onSuccess: (updated, { roleId }) => {
      queryClient.setQueryData(
        getRolesIdPermissionsSuspenseQueryKey(roleId),
        updated
      )
      // The role's users — maybe the signed-in user — now have other permissions.
      void resourceCache.changed('roles')
      notify({
        status: 'success',
        message: t('permissions.notifications.saved'),
      })
    },
    onError: (error) => {
      notify({
        status: 'danger',
        message: apiErrorMessage(
          error,
          'roles',
          'permissions.notifications.saveFailed'
        ),
      })
    },
  })
  const [grants, setGrants] = useState<EditorGrants>(
    saved.grants as EditorGrants
  )

  const savedGrants = saved.grants as EditorGrants
  const canGrant = createPermissionChecker(own.grants)

  // Also highlighted by the tree
  const missing = missingRequirements(grants, definitions)
  const fillable = missing.filter((m) =>
    isGrantable(
      definitions,
      canGrant,
      m.permission.resource,
      m.permission.action
    )
  )
  const changes = countChanges(savedGrants, grants)
  const holdsAny = Object.values(grants).some((actions) => actions.length > 0)

  const canGrantMore = definitions.some(
    (def) => ungrantedActions(grants, definitions, canGrant, def).length > 0
  )

  const handleGrantAll = () => {
    setGrants(
      definitions.reduce((current, def) => {
        const actions = ungrantedActions(current, definitions, canGrant, def)
        return actions.length > 0
          ? grantWithRequirements(current, definitions, def.resource, actions)
          : current
      }, grants)
    )
  }

  const handleGrantMissing = () => {
    setGrants(
      fillable.reduce(
        (current, m) =>
          grantWithRequirements(current, definitions, m.permission.resource, [
            m.permission.action,
          ]),
        grants
      )
    )
  }

  const handleSave = () => {
    updatePermissions({ roleId, grants })
  }

  return (
    <Stack gap="lg">
      {missing.length > 0 && (
        <Alert
          color="red"
          icon={<IconAlertCircle size={16} />}
          title={t('permissions.missing.title', { count: missing.length })}
        >
          <Stack gap="sm" align="flex-start">
            <Text size="sm">
              {fillable.length < missing.length
                ? t('permissions.missing.someNotGrantable')
                : t('permissions.missing.description')}
            </Text>
            {fillable.length > 0 && (
              <Button size="xs" color="red" onClick={handleGrantMissing}>
                {t('permissions.missing.grant')}
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      <Group gap="xs">
        <Button
          size="xs"
          variant="default"
          disabled={!canGrantMore}
          onClick={handleGrantAll}
        >
          {t('permissions.actions.grantAll')}
        </Button>
        <Button
          size="xs"
          variant="default"
          disabled={!holdsAny}
          onClick={() => setGrants({})}
        >
          {t('permissions.actions.clearAll')}
        </Button>
        <Button
          size="xs"
          variant="default"
          disabled={changes === 0}
          onClick={() => setGrants(savedGrants)}
        >
          {t('permissions.actions.reset')}
        </Button>
      </Group>
      <PermissionsTree
        definitions={definitions}
        grants={grants}
        onChange={setGrants}
        canGrant={canGrant}
        missing={missing}
      />
      <Divider />
      <Group justify="flex-end">
        {changes > 0 && (
          <Text size="sm" c="dimmed">
            {t('permissions.unsavedChanges', { count: changes })}
          </Text>
        )}
        <Button
          size="md"
          variant="default"
          disabled={isPending}
          onClick={onCancel}
        >
          {tc('actions.cancel')}
        </Button>
        <Button
          size="md"
          loading={isPending}
          disabled={changes === 0 || missing.length > 0}
          onClick={handleSave}
        >
          {tc('actions.save')}
        </Button>
      </Group>
    </Stack>
  )
}
