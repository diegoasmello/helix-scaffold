import { Layout } from '@helix/ui'

import { sidebarGroups } from './config/sidebar'
import { useAuth } from './modules/auth/use-auth'

export function App() {
  const { user, hasPermission, isAuthenticated } = useAuth()

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

  return <Layout sidebarGroups={visibleGroups} user={user ?? { name: 'Guest' }} />
}
