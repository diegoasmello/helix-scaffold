import { css } from '@emotion/react'
import { Avatar, Group, Menu, Text, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronDown, IconLogout, IconSettings } from '@tabler/icons-react'
import cx from 'clsx'
import { useState } from 'react'

export interface UserMenuProps {
  user: {
    name: string
    avatar?: string
  }
}

export function UserMenu(props: Readonly<UserMenuProps>) {
  const { user } = props

  const { classes } = useStyles()
  const [userMenuOpened, setUserMenuOpened] = useState(false)

  return (
    <Menu
      width={260}
      position="bottom-end"
      transitionProps={{ transition: 'pop-top-right' }}
      onClose={() => setUserMenuOpened(false)}
      onOpen={() => setUserMenuOpened(true)}
      withinPortal
    >
      <Menu.Target>
        <UnstyledButton
          className={cx(classes.user, { [classes.userActive]: userMenuOpened })}
        >
          <Group gap={7}>
            <Avatar src={user.avatar} alt="" radius="xl" size={20} />
            <Text fw={500} size="sm" lh={1} mr={3}>
              {user.name}
            </Text>
            <IconChevronDown size={12} stroke={1.5} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconSettings size={16} stroke={1.5} />}>
          Account settings
        </Menu.Item>
        <Menu.Item leftSection={<IconLogout size={16} stroke={1.5} />}>
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

const useStyles = createStyles(() => ({
  user: css`
    color: light-dark(var(--mantine-color-black), var(--mantine-color-dark-0));
    padding: var(--mantine-spacing-xs) var(--mantine-spacing-sm);
    border-radius: var(--mantine-radius-sm);
    transition: background-color 100ms ease;

    &:hover {
      background-color: light-dark(
        var(--mantine-color-white),
        var(--mantine-color-dark-8)
      );
    }
  `,
  userActive: css`
    background-color: light-dark(
      var(--mantine-color-white),
      var(--mantine-color-dark-8)
    );
  `,
}))
