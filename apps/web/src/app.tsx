import {
  Center,
  DatesProvider,
  Layout,
  Loader,
  usePersistedSidebar,
} from '@helix/ui'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { canSeeSidebarItem, sidebarGroups } from './config/sidebar'
import { authClient } from './lib/authentication'
import { SidebarPreferenceContext } from './lib/sidebar-preference'
import { useAuth } from './modules/auth/use-auth'
import { useSubscription } from './modules/subscriptions/hooks/use-subscription'
import { useSubscriptionAccess } from './modules/subscriptions/hooks/use-subscription-access'

export function App() {
  const { user, hasPermission, isAuthenticated, isPending } = useAuth()
  const { enabled: subscriptionEnabled } = useSubscription()
  const { hasAccess, isPending: subscriptionPending } = useSubscriptionAccess()
  const navigate = useNavigate()
  const { t: tRaw, i18n } = useTranslation('common')
  const t = tRaw as (key: string) => string
  const [sidebarCollapsed, toggleSidebar] = usePersistedSidebar(user?.id)

  if (isPending || subscriptionPending) {
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
        .filter(
          (item) =>
            isAuthenticated &&
            canSeeSidebarItem(item, {
              hasPermission,
              hasSubscriptionAccess: hasAccess,
              subscriptionEnabled,
            })
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
    <DatesProvider settings={{ locale: i18n.language.toLowerCase() }}>
      <SidebarPreferenceContext.Provider
        value={{ sidebarCollapsed, toggleSidebar }}
      >
        <Layout
          sidebarGroups={visibleGroups}
          user={user ?? { name: 'Guest' }}
          onAccountSettings={handleAccountSettings}
          onLogout={handleLogout}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />
      </SidebarPreferenceContext.Provider>
    </DatesProvider>
  )
}
