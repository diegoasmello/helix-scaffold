import { AppShell, Group } from '@mantine/core'
import { useMatches } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import type { BreadcrumbItem } from '../../router'
import { Breadcrumb } from '../breadcrumb/breadcrumb'
import { UserMenu } from '../user-menu/user-menu'

export interface HeaderProps {
  user: { name: string }
  onAccountSettings: () => void
  onLogout: () => void
}

export function Header(props: Readonly<HeaderProps>) {
  const { user, onAccountSettings, onLogout } = props
  const matches = useMatches()
  const { t: tRaw } = useTranslation('common')
  const t = tRaw as (key: string, opts?: object) => string

  const activeMatch = [...matches]
    .reverse()
    .find((m) => m.staticData.breadcrumbs?.length)

  const crumbs: BreadcrumbItem[] = activeMatch
    ? activeMatch.staticData.breadcrumbs!.map((def) => {
        const crumb =
          typeof def === 'function' ? def(activeMatch.loaderData) : def
        return {
          ...crumb,
          label: t(crumb.label, { defaultValue: crumb.label }),
        }
      })
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
          <UserMenu
            user={user}
            onAccountSettings={onAccountSettings}
            onLogout={onLogout}
          />
        </Group>
      </Group>
    </AppShell.Header>
  )
}
