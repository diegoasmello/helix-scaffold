import { css } from '@emotion/react'
import { ActionIcon, AppShell, Tooltip } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconMenu2 } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { UserMenu, type UserMenuProps } from '../user-menu/user-menu'

export interface HeaderProps {
  user: UserMenuProps['user']
  onAccountSettings: () => void
  onLogout: () => void
  /** Opens the navigation drawer — the button shows only below `md`. */
  onOpenNavigation?: () => void
  /** Left side: usually a `HeaderSearch`. */
  search?: ReactNode
  /** Next to the user menu: usually a `NotificationsMenu`. */
  notifications?: ReactNode
  /** Shown only below `md`, next to the menu button (the sidebar is hidden). */
  mobileLogo?: ReactNode
}

export function Header(props: Readonly<HeaderProps>) {
  const {
    user,
    onAccountSettings,
    onLogout,
    onOpenNavigation,
    search,
    notifications,
    mobileLogo,
  } = props

  const { t } = useTranslation('ui')
  const { classes } = useStyles()

  return (
    <AppShell.Header className={classes.header}>
      {onOpenNavigation && (
        <Tooltip label={t('sidebar.open')} position="bottom">
          <ActionIcon
            variant="subtle"
            color="gray"
            size={44}
            radius="xl"
            aria-label={t('sidebar.open')}
            onClick={onOpenNavigation}
            className={classes.burger}
          >
            <IconMenu2 size={22} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      )}
      {mobileLogo && <div className={classes.mobileLogo}>{mobileLogo}</div>}
      {search}
      <div className={classes.end}>
        {notifications}
        <UserMenu
          user={user}
          onAccountSettings={onAccountSettings}
          onLogout={onLogout}
        />
      </div>
    </AppShell.Header>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  header: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md};
    padding: 0 ${theme.spacing.lg};
    ${u.light} {
      background-color: ${theme.white};
      border-bottom: 1px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[7]};
      border-bottom: 1px solid ${theme.colors.dark[5]};
    }

    @media (max-width: calc(${theme.breakpoints.md} - 0.0625em)) {
      gap: 2px;
      padding: 0 ${theme.spacing.xs};
    }
  `,
  burger: css`
    ${u.light} {
      color: ${theme.colors.gray[9]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[0]};
    }

    @media (min-width: ${theme.breakpoints.md}) {
      display: none;
    }
  `,
  mobileLogo: css`
    display: flex;
    align-items: center;
    margin-left: 2px;

    @media (min-width: ${theme.breakpoints.md}) {
      display: none;
    }
  `,
  end: css`
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;

    @media (max-width: calc(${theme.breakpoints.md} - 0.0625em)) {
      gap: 2px;
    }
  `,
}))
