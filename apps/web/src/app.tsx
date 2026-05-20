import { Center, Layout, Loader } from '@helix/ui'
import { useNavigate } from '@tanstack/react-router'

import { sidebarGroups } from './config/sidebar'
import { authClient } from './lib/authentication'
import { useAuth } from './modules/auth/use-auth'

export function App() {
  const { user, hasPermission, isAuthenticated, isPending } = useAuth()
  const navigate = useNavigate()

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  const visibleGroups = sidebarGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.permission
          ? hasPermission(item.permission.resource, item.permission.action)
          : isAuthenticated
      ),
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
