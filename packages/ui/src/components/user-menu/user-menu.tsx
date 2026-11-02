import { css } from '@emotion/react'
import { Menu, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronDown, IconLogout, IconSettings } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export interface UserMenuProps {
  user: {
    name: string
    /** Second line under the name — e.g. the user's role. */
    description?: string
  }
  onAccountSettings: () => void
  onLogout: () => void
}

export function UserMenu(props: Readonly<UserMenuProps>) {
  const { user, onAccountSettings, onLogout } = props

  const { classes } = useStyles()
  const { t } = useTranslation('ui')

  return (
    <Menu
      width={240}
      position="bottom-end"
      transitionProps={{ transition: 'pop-top-right' }}
      withinPortal
    >
      <Menu.Target>
        <UnstyledButton
          className={classes.user}
          aria-label={t('userMenu.openMenu')}
        >
          <span aria-hidden className={classes.avatar}>
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className={classes.text}>
            <span className={classes.name}>{user.name}</span>
            {user.description && (
              <span className={classes.description}>{user.description}</span>
            )}
          </span>
          <IconChevronDown size={16} stroke={1.7} className={classes.chevron} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconSettings size={16} stroke={1.7} />}
          onClick={onAccountSettings}
        >
          {t('userMenu.accountSettings')}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconLogout size={16} stroke={1.7} />}
          onClick={onLogout}
        >
          {t('userMenu.logout')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  user: css`
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 10px 0 6px;
    border-radius: 999px;
    transition: background-color 100ms ease;
    ${u.light} {
      color: ${theme.colors.gray[9]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[0]};
    }

    &:hover,
    &[data-expanded] {
      ${u.light} {
        background-color: ${theme.colors.gray[1]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[6]};
      }
    }

    @media (max-width: calc(${theme.breakpoints.md} - 0.0625em)) {
      padding: 0 6px;
    }
  `,
  avatar: css`
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    ${u.light} {
      background-color: ${theme.colors.gray[9]};
      color: ${theme.white};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[1]};
      color: ${theme.colors.dark[7]};
    }
  `,
  text: css`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.2;

    @media (max-width: calc(${theme.breakpoints.md} - 0.0625em)) {
      display: none;
    }
  `,
  name: css`
    font-size: ${theme.fontSizes.sm};
    font-weight: 600;
  `,
  description: css`
    font-size: 12px;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }
  `,
  chevron: css`
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }

    @media (max-width: calc(${theme.breakpoints.md} - 0.0625em)) {
      display: none;
    }
  `,
}))
