import type {
  PermissionAction,
  PermissionRef,
  PermissionResource,
  ResourceDefinition,
} from '@helix/api-client/types'
import {
  Box,
  Checkbox,
  createStyles,
  css,
  Group,
  notifications,
  notify,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@helix/ui'
import { useTranslation } from 'react-i18next'

import {
  type CanGrant,
  cascadeOf,
  dependentsOf,
  type EditorGrants,
  grantWithRequirements,
  isGrantable,
  type MissingRequirement,
  requirementsOf,
  revokeWithDependents,
  ungrantedActions,
} from '../permission-requirements'

export interface PermissionsTreeProps {
  definitions: ResourceDefinition[]
  grants: EditorGrants
  onChange: (grants: EditorGrants) => void
  disabled?: boolean
  /**
   * Whether the signed-in user may grant a permission (their own role holds
   * it). An unchecked action they may not grant — or whose requirements they
   * may not — is disabled; a checked one can always be unchecked.
   */
  canGrant?: CanGrant
  /**
   * Requirements the grants lack (`missingRequirements()`, computed by the
   * editor, which also needs them): each one is highlighted with what needs it.
   */
  missing?: MissingRequirement[]
}

// One notification at a time: a new click replaces the previous one.
const CASCADE_NOTIFICATION_ID = 'permissions-cascade'

const grantsEverything: CanGrant = () => true
const NOTHING_MISSING: MissingRequirement[] = []

export function PermissionsTree(props: Readonly<PermissionsTreeProps>) {
  const {
    definitions,
    grants,
    onChange,
    disabled,
    canGrant = grantsEverything,
    missing = NOTHING_MISSING,
  } = props

  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')
  const { classes } = useStyles()

  // Resources come from the API catalog: a resource without a translation
  // (e.g. a module added later) falls back to the catalog's English label.
  const resourceLabel = (resource: string) =>
    t(`permissions.resources.${resource}` as 'permissions.resources.todos', {
      defaultValue:
        definitions.find((def) => def.resource === resource)?.label ?? resource,
    })

  // "Roles › View"
  const listOf = (refs: PermissionRef[]) =>
    refs
      .map(
        (ref) =>
          `${resourceLabel(ref.resource)} › ${tc(`actions.${ref.action}`)}`
      )
      .join(', ')

  const neededByOf = (resource: string, action: string) =>
    missing.find(
      (m) =>
        m.permission.resource === resource && m.permission.action === action
    )?.neededBy

  const grantable = (resource: PermissionResource, action: PermissionAction) =>
    isGrantable(definitions, canGrant, resource, action)

  // Why checking or unchecking an action moves others along with it, and why
  // it cannot be checked.
  const hintsOf = (resource: PermissionResource, action: PermissionAction) => {
    const required = requirementsOf(definitions, resource, action)
    const dependents = dependentsOf(definitions, resource, action)
    // The user's role lacks the action itself, or one of what it requires
    const lacksAction = !canGrant(resource, action)
    const ungrantableRequired = required.filter(
      (ref) => !canGrant(ref.resource, ref.action)
    )
    return [
      !disabled && lacksAction && t('permissions.notGrantable'),
      !disabled &&
        !lacksAction &&
        ungrantableRequired.length > 0 &&
        t('permissions.requirementNotGrantable', {
          list: listOf(ungrantableRequired),
        }),
      required.length > 0 &&
        t('permissions.requires', { list: listOf(required) }),
      dependents.length > 0 &&
        t('permissions.requiredBy', { list: listOf(dependents) }),
    ].filter((hint): hint is string => !!hint)
  }

  // Tells what the click checked or unchecked besides the clicked actions.
  const apply = (
    next: EditorGrants,
    clicked: { resource: string; actions: readonly PermissionAction[] }
  ) => {
    onChange(next)
    const { granted, revoked } = cascadeOf(grants, next, definitions, clicked)
    const message =
      granted.length > 0
        ? t('permissions.cascade.granted', { list: listOf(granted) })
        : revoked.length > 0
          ? t('permissions.cascade.revoked', { list: listOf(revoked) })
          : null
    notifications.hide(CASCADE_NOTIFICATION_ID)
    if (message) {
      notify({ id: CASCADE_NOTIFICATION_ID, status: 'info', message })
    }
  }

  return (
    <Stack gap="sm">
      {definitions.map((def) => {
        const resourceGrants = grants[def.resource] ?? []
        const allChecked = def.actions.every((a) => resourceGrants.includes(a))
        const someChecked = def.actions.some((a) => resourceGrants.includes(a))
        const toGrant = ungrantedActions(grants, definitions, canGrant, def)
        const hasMissing = def.actions.some(
          (a) => !!neededByOf(def.resource, a)
        )

        // Checking an action also checks what it requires; unchecking one
        // also unchecks what depends on it (`requires` in the catalog). The
        // resource checkbox checks the actions the user may grant, and
        // unchecks them all once there is nothing left to check.
        const handleToggleAll = () => {
          if (disabled) return
          const clicked = { resource: def.resource, actions: def.actions }
          if (toGrant.length > 0) {
            apply(
              grantWithRequirements(grants, definitions, def.resource, toGrant),
              clicked
            )
          } else {
            apply(
              revokeWithDependents(
                grants,
                definitions,
                def.resource,
                def.actions
              ),
              clicked
            )
          }
        }

        const handleToggleAction = (action: PermissionAction) => {
          if (disabled) return
          const toggle = resourceGrants.includes(action)
            ? revokeWithDependents
            : grantWithRequirements
          apply(toggle(grants, definitions, def.resource, [action]), {
            resource: def.resource,
            actions: [action],
          })
        }

        return (
          <Paper
            key={def.resource}
            p="md"
            withBorder
            className={hasMissing ? classes.missing : undefined}
          >
            <Checkbox
              label={
                <Text component="span" fw={600} size="sm">
                  {resourceLabel(def.resource)}
                </Text>
              }
              checked={allChecked}
              indeterminate={!allChecked && someChecked}
              onChange={handleToggleAll}
              disabled={disabled || (!someChecked && toGrant.length === 0)}
            />
            <Group ml={28} mt="sm" gap="xl" align="flex-start">
              {def.actions.map((action) => {
                const checked = resourceGrants.includes(action)
                const neededBy = neededByOf(def.resource, action)
                const hints = hintsOf(def.resource, action)
                return (
                  <Tooltip
                    key={action}
                    label={
                      <Stack gap={2}>
                        {hints.map((hint) => (
                          <Text key={hint} size="xs">
                            {hint}
                          </Text>
                        ))}
                      </Stack>
                    }
                    disabled={hints.length === 0}
                    multiline
                    maw={320}
                    withArrow
                  >
                    <Box>
                      <Checkbox
                        label={tc(`actions.${action}`)}
                        checked={checked}
                        onChange={() => handleToggleAction(action)}
                        // Unchecking is always allowed: it never grants.
                        disabled={
                          disabled ||
                          (!checked && !grantable(def.resource, action))
                        }
                        error={
                          neededBy &&
                          t('permissions.neededBy', { list: listOf(neededBy) })
                        }
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

const useStyles = createStyles((theme) => ({
  missing: css`
    border-color: ${theme.colors.red[6]};
  `,
}))
