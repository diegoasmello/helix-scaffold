import type { MantineColor } from '@mantine/core'
import { ActionIcon, Menu, Tooltip } from '@mantine/core'
import { IconDots } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export interface ActionsMenuItemConfig {
  label: string
  onClick: () => void
  color?: MantineColor
}

export interface ActionsMenuProps {
  items: ActionsMenuItemConfig[]
}

export function ActionsMenu(props: Readonly<ActionsMenuProps>) {
  const { items } = props

  const { t } = useTranslation('ui')
  const label = t('rowActions.more')

  return (
    <Menu position="bottom-end" withinPortal>
      <Tooltip label={label}>
        <Menu.Target>
          <ActionIcon variant="default" size="md" aria-label={label}>
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
      </Tooltip>
      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item key={item.label} color={item.color} onClick={item.onClick}>
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}
