import { LanguagePicker, Stack, Switch, Text, Title } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import { useSidebarPreference } from '../../../lib/sidebar-preference'

export function MePreferences() {
  const { t } = useTranslation('me')
  const { sidebarCollapsed, toggleSidebar } = useSidebarPreference()

  return (
    <Stack gap="xl">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={4} lh={1.2}>
            {t('preferences.language.sectionTitle')}
          </Title>
          <Text c="dimmed" size="xs">
            {t('preferences.language.sectionDescription')}
          </Text>
        </Stack>
        <LanguagePicker />
      </Stack>

      <Stack gap="md">
        <Stack gap={4}>
          <Title order={4} lh={1.2}>
            {t('preferences.navigation.sectionTitle')}
          </Title>
          <Text c="dimmed" size="xs">
            {t('preferences.navigation.sectionDescription')}
          </Text>
        </Stack>
        <Switch
          label={t('preferences.navigation.hideSidebar')}
          checked={sidebarCollapsed}
          onChange={toggleSidebar}
        />
      </Stack>
    </Stack>
  )
}
