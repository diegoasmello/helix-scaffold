import type {
  PermissionAction,
  ResourceDefinition,
} from '@helix/api-client/types'
import { Box, Checkbox, Group, Paper, Stack, Text, Tooltip } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import {
  grantWithRequirements,
  requirementsOf,
  revokeWithDependents,
} from '../permission-requirements'

export interface PermissionsTreeProps {
  definitions: ResourceDefinition[]
  grants: Record<string, PermissionAction[]>
  onChange: (grants: Record<string, PermissionAction[]>) => void
  disabled?: boolean
}

export function PermissionsTree(props: Readonly<PermissionsTreeProps>) {
  const { definitions, grants, onChange, disabled } = props

  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')

  // Resources come from the API catalog: a resource without a translation
  // (e.g. a module added later) falls back to the catalog's English label.
  const resourceLabel = (resource: string) =>
    t(`permissions.resources.${resource}` as 'permissions.resources.todos', {
      defaultValue:
        definitions.find((def) => def.resource === resource)?.label ?? resource,
    })

  // "Requires: Roles › View" — why checking an action checks others too.
  const requirementsHint = (resource: string, action: PermissionAction) => {
    const required = requirementsOf(definitions, resource, action)
    if (required.length === 0) return null
    return t('permissions.requires', {
      list: required
        .map(
          (ref) =>
            `${resourceLabel(ref.resource)} › ${tc(`actions.${ref.action}`)}`
        )
        .join(', '),
    })
  }

  return (
    <Stack gap="sm">
      {definitions.map((def) => {
        const resourceGrants = grants[def.resource] ?? []
        const allChecked = def.actions.every((a) => resourceGrants.includes(a))
        const someChecked = def.actions.some((a) => resourceGrants.includes(a))

        // Checking an action also checks what it requires; unchecking one
        // also unchecks what depends on it (`requires` in the catalog).
        const handleToggleAll = () => {
          if (disabled) return
          onChange(
            allChecked
              ? revokeWithDependents(
                  grants,
                  definitions,
                  def.resource,
                  def.actions
                )
              : grantWithRequirements(
                  grants,
                  definitions,
                  def.resource,
                  def.actions
                )
          )
        }

        const handleToggleAction = (action: PermissionAction) => {
          if (disabled) return
          const toggle = resourceGrants.includes(action)
            ? revokeWithDependents
            : grantWithRequirements
          onChange(toggle(grants, definitions, def.resource, [action]))
        }

        return (
          <Paper key={def.resource} p="md" withBorder>
            <Checkbox
              label={
                <Text component="span" fw={600} size="sm">
                  {resourceLabel(def.resource)}
                </Text>
              }
              checked={allChecked}
              indeterminate={!allChecked && someChecked}
              onChange={handleToggleAll}
              disabled={disabled}
            />
            <Group ml={28} mt="sm" gap="xl">
              {def.actions.map((action) => {
                const hint = requirementsHint(def.resource, action)
                return (
                  <Tooltip key={action} label={hint} disabled={!hint} withArrow>
                    <Box>
                      <Checkbox
                        label={tc(`actions.${action}`)}
                        checked={resourceGrants.includes(action)}
                        onChange={() => handleToggleAction(action)}
                        disabled={disabled}
                      />
                    </Box>
                  </Tooltip>
                )
              })}
            </Group>
          </Paper>
        )
      })}
    </Stack>
  )
}
