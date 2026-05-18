import { AppShell, Container } from '@mantine/core'
import { Outlet } from '@tanstack/react-router'
import { useState } from 'react'

import Logo from '../../assets/helix.svg'
import { Header } from '../header/header'
import { Sidebar } from '../sidebar/sidebar'
import type { SidebarGroup } from '../sidebar/types'

export interface LayoutProps {
  sidebarGroups: SidebarGroup[]
  user: { id?: string; name: string; avatar?: string }
}

const SIDEBAR_WIDTH = 280
const SIDEBAR_COLLAPSED_WIDTH = 72

function usePersistedSidebar(userId: string | undefined) {
  const key = userId ? `sidebar:collapsed:${userId}` : null

  const [collapsed, setCollapsed] = useState(() => {
    if (!key) return false
    try {
      return localStorage.getItem(key) === 'true'
    } catch {
      return false
    }
  })

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      if (key) {
        try {
          localStorage.setItem(key, String(next))
        } catch {
          // localStorage unavailable (e.g. private browsing)
        }
      }
      return next
    })
  }

  return [collapsed, toggle] as const
}

export function Layout(props: Readonly<LayoutProps>) {
  const { sidebarGroups, user } = props

  const [sidebarCollapsed, toggleSidebar] = usePersistedSidebar(user.id)

  return (
    <AppShell
      padding="md"
      header={{ height: 60 }}
      navbar={{
        width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        breakpoint: 'sm',
        collapsed: { mobile: sidebarCollapsed },
      }}
      layout="alt"
      withBorder={false}
    >
      <Header user={user} />

      <AppShell.Navbar unstyled style={{ padding: 0, overflow: 'visible' }}>
        <Sidebar
          groups={sidebarGroups}
          logo={<img src={Logo} alt="Logo" height={24} />}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
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
