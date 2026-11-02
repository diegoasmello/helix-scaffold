import { type PageTab, PageTabs, PageView } from '@helix/ui'
import { Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useSubscription } from '../../subscriptions/hooks/use-subscription'

export function MePage() {
  const { t } = useTranslation('me')
  const { enabled: subscriptionEnabled } = useSubscription()

  const tabs: PageTab[] = [
    { label: t('page.nav.account'), to: '/me/account' },
    { label: t('page.nav.security'), to: '/me/security' },
    { label: t('page.nav.preferences'), to: '/me/preferences' },
    ...(subscriptionEnabled
      ? [{ label: t('page.nav.subscription'), to: '/me/subscription' } as const]
      : []),
  ]

  return (
    <PageView
      title={t('page.title')}
      description={t('page.description')}
      tabs={<PageTabs label={t('page.title')} tabs={tabs} />}
    >
      <Outlet />
    </PageView>
  )
}
