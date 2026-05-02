import { AppShell, Container } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet } from '@tanstack/react-router'

import Logo from '../../assets/helix.svg'
import { Header } from '../header/header'
import { Sidebar } from '../sidebar/sidebar'
import type { SidebarItem } from '../sidebar/types'

export interface LayoutProps {
  sidebarItems: SidebarItem[]
  user: { name: string; avatar?: string }
}

export function Layout(props: Readonly<LayoutProps>) {
  const { sidebarItems, user } = props

  const [opened, { toggle }] = useDisclosure()

  return (
    <AppShell
      padding="md"
      header={{ height: 60 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      layout="alt"
    >
      <Header opened={opened} onToggle={toggle} user={user} />

      <AppShell.Navbar unstyled style={{ padding: 0 }}>
        <Sidebar
          items={sidebarItems}
          logo={<img src={Logo} alt="Logo" height={32} />}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Container fluid>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
