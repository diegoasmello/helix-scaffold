import { Grid, GridCol, NavigationItem, Title } from '@helix/ui'
import {
  IconCreditCard,
  IconKey,
  IconLock,
  IconSettings,
  IconUser,
} from '@helix/ui'
import { Paper, Stack, Text } from '@helix/ui'
import { Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useSubscriptionMode } from '../../subscription/use-subscription-mode'

export function MePage() {
  const { t } = useTranslation('me')
  const { enabled: subscriptionEnabled } = useSubscriptionMode()

  return (
    <Grid>
      <GridCol span={3} h="calc(100vh - 100px)">
        <Paper p="lg" h="100%">
          <Stack gap={16}>
            <Stack gap={4}>
              <Title order={4} lh={1.2}>
                {t('page.title')}
              </Title>
              <Text c="dimmed" size="xs">
                {t('page.description')}
              </Text>
            </Stack>

            <Stack gap={8}>
              <NavigationItem
                label={t('page.nav.account')}
                icon={IconUser}
                to="/me/account"
              />
              <NavigationItem
                label={t('page.nav.signIn')}
                icon={IconKey}
                to="/me/sign-in"
              />
              <NavigationItem
                label={t('page.nav.security')}
                icon={IconLock}
                to="/me/security"
              />
              <NavigationItem
                label={t('page.nav.preferences')}
                icon={IconSettings}
                to="/me/preferences"
              />
              {subscriptionEnabled && (
                <NavigationItem
                  label={t('page.nav.subscription')}
                  icon={IconCreditCard}
                  to="/me/subscription"
                />
              )}
            </Stack>
          </Stack>
        </Paper>
      </GridCol>
      <GridCol span={9}>
        <Paper p="lg">
          <Outlet />
        </Paper>
      </GridCol>
    </Grid>
  )
}
