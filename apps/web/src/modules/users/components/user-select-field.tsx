import { useGetUsersAllSuspense } from '@helix/api-client/hooks'
import { Select, type SelectProps } from '@helix/ui'
import { useTranslation } from 'react-i18next'

type UserSelectFieldProps = Omit<SelectProps, 'data'>

export function UserSelectField(props: Readonly<UserSelectFieldProps>) {
  const { data: users } = useGetUsersAllSuspense()
  const { t } = useTranslation('users')

  return (
    <Select
      data={users.map((u) => ({
        value: u.id,
        label: `${u.name} (${u.email})`,
      }))}
      label={t('form.userSelect.label')}
      placeholder={t('form.userSelect.placeholder')}
      searchable
      clearable
      {...props}
    />
  )
}
