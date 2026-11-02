import { css } from '@emotion/react'
import { AppShell, Container, Drawer } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { useDisclosure } from '@mantine/hooks'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'

import Logo from '../../assets/helix.svg'
import LogoIcon from '../../assets/helix-icon.svg'
import { usePersistedSidebar } from '../../hooks/use-persisted-sidebar'
import { Header } from '../header/header'
import { Sidebar } from '../sidebar/sidebar'
import type { SidebarGroup } from '../sidebar/types'

export interface LayoutProps {
  sidebarGroups: SidebarGroup[]
  user: { id?: string; name: string; description?: string }
  onAccountSettings: () => void
  onLogout: () => void
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  /** Header search field — usually a `HeaderSearch`. */
  search?: ReactNode
  /** Header bell — usually a `NotificationsMenu`. */
  notifications?: ReactNode
}

const SIDEBAR_WIDTH = 272
const SIDEBAR_COLLAPSED_WIDTH = 72
const HEADER_HEIGHT = 68

export function Layout(props: Readonly<LayoutProps>) {
  const {
    sidebarGroups,
    user,
    onAccountSettings,
    onLogout,
    sidebarCollapsed: externalCollapsed,
    onToggleSidebar: externalToggle,
    search,
    notifications,
  } = props

  const { classes } = useStyles()
  const [internalCollapsed, internalToggle] = usePersistedSidebar(user.id)
  const [drawerOpened, drawer] = useDisclosure(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const sidebarCollapsed = externalCollapsed ?? internalCollapsed
  const toggleSidebar = externalToggle ?? internalToggle

  // Following a link in the drawer closes it.
  useEffect(() => {
    drawer.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const logo = (
    <img src={Logo} alt="Helix" height={24} className={classes.logoImg} />
  )
  const logoIcon = (
    <img src={LogoIcon} alt="Helix" height={26} className={classes.logoImg} />
  )

  return (
    <AppShell
      header={{ height: HEADER_HEIGHT }}
      navbar={{
        width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        breakpoint: 'md',
        // Below `md` the sidebar lives in the drawer instead.
        collapsed: { mobile: true },
      }}
      layout="alt"
      withBorder={false}
    >
      <Header
        user={user}
        onAccountSettings={onAccountSettings}
        onLogout={onLogout}
        onOpenNavigation={drawer.open}
        mobileLogo={logoIcon}
        search={search}
        notifications={notifications}
      />

      <AppShell.Navbar unstyled className={classes.navbar}>
        <Sidebar
          groups={sidebarGroups}
          expandedLogo={logo}
          collapsedLogo={logoIcon}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />
      </AppShell.Navbar>

      <Drawer
        opened={drawerOpened}
        onClose={drawer.close}
        size={324}
        withCloseButton={false}
        padding={0}
        offset={0}
        radius={0}
        hiddenFrom="md"
        classNames={{ body: classes.drawerBody }}
      >
        <Sidebar
          groups={sidebarGroups}
          expandedLogo={logo}
          collapsedLogo={logoIcon}
          onClose={drawer.close}
        />
      </Drawer>

      <AppShell.Main className={classes.main}>
        <Container fluid className={classes.container}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  logoImg: css`
    display: block;
    ${u.dark} {
      filter: invert(1);
    }
  `,
  navbar: css`
    padding: 0;
    overflow: visible;
  `,
  drawerBody: css`
    height: 100%;
  `,
  main: css`
    display: flex;
    flex-direction: column;
    ${u.light} {
      background-color: ${theme.white};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[7]};
    }
  `,
  // The page gutters are variables so full-bleed pages (`PageView`,
  // `PageCreate`, `PageEdit`) can cancel them and draw edge-to-edge borders.
  container: css`
    --helix-page-px: 28px;
    --helix-page-pt: 28px;
    --helix-page-pb: ${theme.spacing.xl};
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--helix-page-pt) var(--helix-page-px) var(--helix-page-pb);

    @media (max-width: calc(${theme.breakpoints.md} - 0.0625em)) {
      --helix-page-px: ${theme.spacing.md};
      --helix-page-pt: 20px;
      --helix-page-pb: 28px;
    }
  `,
}))
