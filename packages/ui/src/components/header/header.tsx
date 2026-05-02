import {
  Anchor,
  AppShell,
  Breadcrumbs,
  Burger,
  Divider,
  Group,
  Text,
} from '@mantine/core'
import { Link, useMatches } from '@tanstack/react-router'

import type { BreadcrumbItem } from '../../router'
import { LanguagePicker } from '../language-picker/language-picker'
import { UserMenu } from '../user-menu/user-menu'

export interface HeaderProps {
  opened: boolean
  onToggle: () => void
  user: { name: string; avatar?: string }
}

export function Header(props: Readonly<HeaderProps>) {
  const { opened, onToggle, user } = props
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
      <Burger opened={opened} onClick={onToggle} size="sm" />
      <Divider orientation="vertical" />
      <Group justify="space-between" style={{ width: '100%' }}>
        <Breadcrumbs>
          {crumbs.map((crumb, i) =>
            crumb.to ? (
              <Anchor component={Link} to={crumb.to} key={`${crumb.to}-${i}`}>
                {crumb.label}
              </Anchor>
            ) : (
              <Text size="sm" key={`${crumb.label}-${i}`}>
                {crumb.label}
              </Text>
            )
          )}
        </Breadcrumbs>
        <Group>
          <LanguagePicker />
          <UserMenu user={user} />
        </Group>
      </Group>
    </AppShell.Header>
  )
}
