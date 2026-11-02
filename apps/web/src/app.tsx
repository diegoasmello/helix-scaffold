import {
  Center,
  DatesProvider,
  HeaderSearch,
  Layout,
  Loader,
  NotificationsMenu,
  notify,
  usePersistedSidebar,
} from '@helix/ui'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { canSeeSidebarItem, sidebarGroups } from './config/sidebar'
import { authClient } from './lib/authentication'
import { SidebarPreferenceContext } from './lib/sidebar-preference'
import { checkPageAccess } from './modules/auth/page-access'
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

  const checkers = {
    hasPermission,
    hasSubscriptionAccess: hasAccess,
    subscriptionEnabled,
  }

  const visibleGroups = sidebarGroups
    .map((group) => ({
      title: group.titleKey ? t(group.titleKey) : undefined,
      items: group.items
        .filter((item) => isAuthenticated && canSeeSidebarItem(item, checkers))
        .map(({ actionAccess, action, ...item }) => ({
          ...item,
          label: t(item.label),
          action:
            action &&
            (!actionAccess || checkPageAccess(actionAccess, checkers).allowed)
              ? { ...action, label: t(action.label) }
              : undefined,
        })),
    }))
    .filter((group) => group.items.length > 0)

  const handleAccountSettings = () => navigate({ to: '/me' })

  const handleLogout = async () => {
    await authClient.signOut()
  }

  // The header's search and bell are ready, but nothing feeds them yet: wire
  // `onSearch` to a search endpoint and `items` to a notifications query.
  const handleSearch = () => {
    notify({ status: 'info', message: t('search.notAvailable') })
  }

  return (
    <DatesProvider settings={{ locale: i18n.language.toLowerCase() }}>
      <SidebarPreferenceContext.Provider
        value={{ sidebarCollapsed, toggleSidebar }}
      >
        <Layout
          sidebarGroups={visibleGroups}
          user={
            user
              ? { ...user, description: user.roleName ?? user.email }
              : { name: 'Guest' }
          }
          onAccountSettings={handleAccountSettings}
          onLogout={handleLogout}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          search={<HeaderSearch onSearch={handleSearch} />}
          notifications={<NotificationsMenu items={[]} />}
        />
      </SidebarPreferenceContext.Provider>
    </DatesProvider>
  )
}
