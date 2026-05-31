import { Center, Layout, Loader } from '@helix/ui'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { sidebarGroups } from './config/sidebar'
import { authClient } from './lib/authentication'
import { useAuth } from './modules/auth/use-auth'

export function App() {
  const { user, hasPermission, isAuthenticated, isPending } = useAuth()
  const navigate = useNavigate()
  const { t: tRaw } = useTranslation('common')
  const t = tRaw as (key: string) => string

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  const visibleGroups = sidebarGroups
    .map((group) => ({
      title: group.titleKey ? t(group.titleKey) : undefined,
      items: group.items
        .filter((item) =>
          item.permission
            ? hasPermission(item.permission.resource, item.permission.action)
            : isAuthenticated
        )
        .map((item) => ({
          ...item,
          label: t(item.label),
        })),
    }))
    .filter((group) => group.items.length > 0)

  const handleAccountSettings = () => navigate({ to: '/me' })

  const handleLogout = async () => {
    await authClient.signOut()
  }

  return (
    <Layout
      sidebarGroups={visibleGroups}
      user={user ?? { name: 'Guest' }}
      onAccountSettings={handleAccountSettings}
      onLogout={handleLogout}
    />
  )
}
