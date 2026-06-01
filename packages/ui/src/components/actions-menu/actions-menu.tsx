import type { MantineColor } from '@mantine/core'
import { ActionIcon, Menu } from '@mantine/core'
import { IconDots } from '@tabler/icons-react'

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

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="default" size="md" aria-label="Actions">
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
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
