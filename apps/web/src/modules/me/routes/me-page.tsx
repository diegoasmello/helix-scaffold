import { Grid, GridCol, NavigationItem, Title } from '@helix/ui'
import { Paper, Stack, Text } from '@helix/ui'
import { IconKey, IconLock, IconUser } from '@helix/ui'
import { Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export function MePage() {
  const { t } = useTranslation('me')

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
