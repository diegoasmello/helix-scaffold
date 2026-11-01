import type {
  PermissionAction,
  ResourceDefinition,
} from '@helix/api-client/types'
import { Checkbox, Group, Paper, Stack, Text } from '@helix/ui'
import { useTranslation } from 'react-i18next'

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
  const resourceLabel = (def: ResourceDefinition) =>
    t(
      `permissions.resources.${def.resource}` as 'permissions.resources.todos',
      {
        defaultValue: def.label,
      }
    )

  return (
    <Stack gap="sm">
      {definitions.map((def) => {
        const resourceGrants = grants[def.resource] ?? []
        const allChecked = def.actions.every((a) => resourceGrants.includes(a))
        const someChecked = def.actions.some((a) => resourceGrants.includes(a))

        const handleToggleAll = () => {
          if (disabled) return
          onChange({
            ...grants,
            [def.resource]: allChecked ? [] : [...def.actions],
          })
        }

        const handleToggleAction = (action: PermissionAction) => {
          if (disabled) return
          const current = grants[def.resource] ?? []
          const next = current.includes(action)
            ? current.filter((a) => a !== action)
            : [...current, action]
          onChange({ ...grants, [def.resource]: next })
        }

        return (
          <Paper key={def.resource} p="md" withBorder>
            <Checkbox
              label={
                <Text component="span" fw={600} size="sm">
                  {resourceLabel(def)}
                </Text>
              }
              checked={allChecked}
              indeterminate={!allChecked && someChecked}
              onChange={handleToggleAll}
              disabled={disabled}
            />
            <Group ml={28} mt="sm" gap="xl">
              {def.actions.map((action) => (
                <Checkbox
                  key={action}
                  label={tc(`actions.${action}`)}
                  checked={resourceGrants.includes(action)}
                  onChange={() => handleToggleAction(action)}
                  disabled={disabled}
                />
              ))}
            </Group>
          </Paper>
        )
      })}
    </Stack>
  )
}
