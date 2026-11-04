import { css } from '@emotion/react'
import { ActionIcon, Button, Group, Menu } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconDots } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import { useDataTableLayout } from '../data-table/data-table-layout'

export interface RowAction {
  label: string
  onClick: () => void
  /** Destructive (e.g. delete): drawn in red. */
  danger?: boolean
  /** `true` leaves the action out — e.g. the user lacks its permission. */
  hidden?: boolean
}

export interface RowActionsProps {
  actions: RowAction[]
  /** Accessible name of the "⋯" menu button. Defaults to "Actions". */
  menuLabel?: string
  /** Up to this many visible actions are buttons; more collapse into a menu. */
  maxInlineActions?: number
}

/**
 * A `DataTable` row's actions: up to 3 text buttons side by side, or a single
 * "⋯" menu when there are more. Hidden actions do not count. In the mobile
 * card layout the buttons fill the card's width.
 */
export function RowActions(props: Readonly<RowActionsProps>) {
  const { actions, menuLabel, maxInlineActions = 3 } = props

  const { t } = useTranslation('ui')
  const { classes } = useStyles()
  const layout = useDataTableLayout()

  const visible = actions.filter((action) => !action.hidden)
  const label = menuLabel ?? t('rowActions.more')
  const inCard = layout === 'cards'

  if (visible.length === 0) return null

  if (visible.length > maxInlineActions) {
    return (
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          {inCard ? (
            <Button
              variant="default"
              fullWidth
              className={classes.cardButton}
              leftSection={<IconDots size={16} />}
            >
              {label}
            </Button>
          ) : (
            <ActionIcon variant="default" size="md" aria-label={label}>
              <IconDots size={16} />
            </ActionIcon>
          )}
        </Menu.Target>
        <Menu.Dropdown>
          {visible.map((action) => (
            <Menu.Item
              key={action.label}
              color={action.danger ? 'red' : undefined}
              onClick={action.onClick}
            >
              {action.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    )
  }

  return (
    <Group gap="xs" wrap="nowrap" grow={inCard} justify="flex-end">
      {visible.map((action) => (
        <Button
          key={action.label}
          variant="default"
          color={action.danger ? 'red' : undefined}
          size={inCard ? 'sm' : 'xs'}
          className={inCard ? classes.cardButton : undefined}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
    </Group>
  )
}

const useStyles = createStyles(() => ({
  cardButton: css`
    height: 44px;
  `,
}))
