import {
  FormSection,
  LanguagePicker,
  Switch,
  useMantineColorScheme,
} from '@helix/ui'
import { useTranslation } from 'react-i18next'

import { appConfig } from '../../../config/app'
import { useSidebarPreference } from '../../../lib/sidebar-preference'

export function MePreferences() {
  const { t } = useTranslation('me')
  const { sidebarCollapsed, toggleSidebar } = useSidebarPreference()
  const { colorScheme, setColorScheme } = useMantineColorScheme()

  return (
    <>
      <FormSection
        title={t('preferences.language.sectionTitle')}
        description={t('preferences.language.sectionDescription')}
      >
        <LanguagePicker languages={appConfig.i18n.languages} />
      </FormSection>

      <FormSection
        title={t('preferences.appearance.sectionTitle')}
        description={t('preferences.appearance.sectionDescription')}
      >
        <Switch
          label={t('preferences.appearance.darkMode')}
          checked={colorScheme === 'dark'}
          onChange={(e) =>
            setColorScheme(e.currentTarget.checked ? 'dark' : 'light')
          }
        />
      </FormSection>

      <FormSection
        title={t('preferences.navigation.sectionTitle')}
        description={t('preferences.navigation.sectionDescription')}
      >
        <Switch
          label={t('preferences.navigation.hideSidebar')}
          checked={sidebarCollapsed}
          onChange={toggleSidebar}
        />
      </FormSection>
    </>
  )
}
