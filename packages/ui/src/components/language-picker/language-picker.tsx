import { Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'

const data = [
  { label: 'English', value: 'en' },
  { label: 'Português (Brasil)', value: 'pt-BR' },
]

export function LanguagePicker() {
  const { i18n } = useTranslation()

  return (
    <Select
      data={data}
      value={i18n.resolvedLanguage ?? 'en'}
      onChange={(value) => {
        if (value) i18n.changeLanguage(value)
      }}
      allowDeselect={false}
    />
  )
}
