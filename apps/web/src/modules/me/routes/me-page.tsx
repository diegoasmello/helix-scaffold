import { Grid, GridCol, NavigationItem, Title } from '@helix/ui'
import { Paper, Stack, Text } from '@helix/ui'
import { IconLock, IconUser } from '@helix/ui'
import { Outlet } from '@tanstack/react-router'

export function MePage() {
  return (
    <Grid>
      <GridCol span={3} h="calc(100vh - 100px)">
        <Paper p="lg" h="100%">
          <Stack gap={16}>
            <Stack gap={4}>
              <Title order={4} lh={1.2}>
                Account settings
              </Title>
              <Text c="dimmed" size="xs">
                Update your name and email address.
              </Text>
            </Stack>

            <Stack gap={8}>
              <NavigationItem
                label="Account"
                icon={IconUser}
                to="/me/account"
              />
              <NavigationItem
                label="Security"
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
