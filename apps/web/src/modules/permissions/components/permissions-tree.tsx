import type {
  PermissionAction,
  ResourceDefinition,
} from '@helix/api-client/types'
import { Checkbox, Group, Paper, Stack, Text } from '@helix/ui'

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
}

export interface PermissionsTreeProps {
  definitions: ResourceDefinition[]
  grants: Record<string, PermissionAction[]>
  onChange: (grants: Record<string, PermissionAction[]>) => void
}

export function PermissionsTree(props: Readonly<PermissionsTreeProps>) {
  const { definitions, grants, onChange } = props

  return (
    <Stack gap="sm">
      {definitions.map((def) => {
        const resourceGrants = grants[def.resource] ?? []
        const allChecked = def.actions.every((a) => resourceGrants.includes(a))
        const someChecked = def.actions.some((a) => resourceGrants.includes(a))

        const handleToggleAll = () => {
          onChange({
            ...grants,
            [def.resource]: allChecked ? [] : [...def.actions],
          })
        }

        const handleToggleAction = (action: PermissionAction) => {
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
                <Text fw={600} size="sm">
                  {def.label}
                </Text>
              }
              checked={allChecked}
              indeterminate={!allChecked && someChecked}
              onChange={handleToggleAll}
            />
            <Group ml={28} mt="sm" gap="xl">
              {def.actions.map((action) => (
                <Checkbox
                  key={action}
                  label={ACTION_LABELS[action]}
                  checked={resourceGrants.includes(action)}
                  onChange={() => handleToggleAction(action)}
                />
              ))}
            </Group>
          </Paper>
        )
      })}
    </Stack>
  )
}
