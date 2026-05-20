import { AppShell, Group } from '@mantine/core'
import { useMatches } from '@tanstack/react-router'

import type { BreadcrumbItem } from '../../router'
import { Breadcrumb } from '../breadcrumb/breadcrumb'
import { UserMenu } from '../user-menu/user-menu'

export interface HeaderProps {
  user: { name: string }
}

export function Header(props: Readonly<HeaderProps>) {
  const { user } = props
  const matches = useMatches()

  const activeMatch = [...matches]
    .reverse()
    .find((m) => m.staticData.breadcrumbs?.length)

  const crumbs: BreadcrumbItem[] = activeMatch
    ? activeMatch.staticData.breadcrumbs!.map((def) =>
        typeof def === 'function' ? def(activeMatch.loaderData) : def
      )
    : []

  return (
    <AppShell.Header
      styles={{
        header: {
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          gap: '1rem',
        },
      }}
    >
      <Group justify="space-between" style={{ width: '100%' }}>
        <Breadcrumb crumbs={crumbs} />
        <Group>
          <UserMenu user={user} />
        </Group>
      </Group>
    </AppShell.Header>
  )
}
