import { Layout } from '@helix/ui'

import { sidebarItems } from './config/sidebar'
import { useAuth } from './modules/auth/use-auth'

export function App() {
  const { user, hasPermission, isAuthenticated } = useAuth()

  const visibleItems = sidebarItems.filter((item) =>
    item.permission
      ? hasPermission(item.permission.resource, item.permission.action)
      : isAuthenticated
  )

  return <Layout sidebarItems={visibleItems} user={user ?? { name: 'Guest' }} />
}
