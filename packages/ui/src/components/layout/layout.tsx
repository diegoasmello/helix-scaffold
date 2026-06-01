import { css } from '@emotion/react'
import { AppShell, Container } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { Outlet } from '@tanstack/react-router'

import Logo from '../../assets/helix.svg'
import LogoIcon from '../../assets/helix-icon.svg'
import { usePersistedSidebar } from '../../hooks/use-persisted-sidebar'
import { Header } from '../header/header'
import { Sidebar } from '../sidebar/sidebar'
import type { SidebarGroup } from '../sidebar/types'

export interface LayoutProps {
  sidebarGroups: SidebarGroup[]
  user: { id?: string; name: string; avatar?: string }
  onAccountSettings: () => void
  onLogout: () => void
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

const SIDEBAR_WIDTH = 256
const SIDEBAR_COLLAPSED_WIDTH = 72

export function Layout(props: Readonly<LayoutProps>) {
  const {
    sidebarGroups,
    user,
    onAccountSettings,
    onLogout,
    sidebarCollapsed: externalCollapsed,
    onToggleSidebar: externalToggle,
  } = props

  const { classes } = useStyles()
  const [internalCollapsed, internalToggle] = usePersistedSidebar(user.id)

  const sidebarCollapsed = externalCollapsed ?? internalCollapsed
  const toggleSidebar = externalToggle ?? internalToggle

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        breakpoint: 'sm',
        collapsed: { mobile: sidebarCollapsed },
      }}
      layout="alt"
      withBorder={false}
    >
      <Header
        user={user}
        onAccountSettings={onAccountSettings}
        onLogout={onLogout}
      />

      <AppShell.Navbar unstyled style={{ padding: 0, overflow: 'visible' }}>
        <Sidebar
          groups={sidebarGroups}
          expandedLogo={
            <img
              src={Logo}
              alt="Logo"
              height={26}
              className={classes.logoImg}
            />
          }
          collapsedLogo={
            <img
              src={LogoIcon}
              alt="Logo"
              height={26}
              className={classes.logoImg}
            />
          }
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <div className={classes.inner}>
          <Container fluid>
            <Outlet />
          </Container>
        </div>
      </AppShell.Main>
    </AppShell>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  logoImg: css`
    ${u.dark} {
      filter: invert(1);
    }
  `,
  main: css`
    display: flex;
    flex-direction: column;
  `,
  inner: css`
    flex: 1;
    border-top-left-radius: ${theme.radius.lg};
    padding-top: ${theme.spacing.lg};
    padding-left: ${theme.spacing.xs};
    padding-right: ${theme.spacing.xs};
    padding-bottom: ${theme.spacing.lg};
    ${u.light} {
      background-color: ${theme.colors.gray[1]};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[8]};
    }
  `,
}))
