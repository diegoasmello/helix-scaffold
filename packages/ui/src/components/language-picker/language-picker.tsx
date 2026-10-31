import { Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export interface LanguageOption {
  value: string
  label: string
}

export interface LanguagePickerProps {
  languages: readonly LanguageOption[]
}

export function LanguagePicker(props: Readonly<LanguagePickerProps>) {
  const { languages } = props

  const { i18n } = useTranslation()

  return (
    <Select
      data={[...languages]}
      value={i18n.resolvedLanguage ?? languages[0]?.value}
      onChange={(value) => {
        if (value) i18n.changeLanguage(value)
      }}
      allowDeselect={false}
    />
  )
}
