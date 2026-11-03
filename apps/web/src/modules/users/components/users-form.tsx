import type { UseFormReturnType } from '@helix/ui'
import { FormColumn, PasswordInput, TextInput } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import { RoleSelectField } from '../../roles/components/role-select-field'
import type { UserFormValues } from '../types'

export interface UsersFormProps {
  form: UseFormReturnType<UserFormValues>
  isEditing?: boolean
}

export function UsersForm(props: Readonly<UsersFormProps>) {
  const { form, isEditing } = props
  const { t } = useTranslation('users')

  return (
    <FormColumn>
      <TextInput
        label={t('form.name.label')}
        placeholder={t('form.name.placeholder')}
        required
        {...form.getInputProps('name')}
      />
      <TextInput
        label={t('form.email.label')}
        placeholder={t('form.email.placeholder')}
        type="email"
        required
        {...form.getInputProps('email')}
      />
      {!isEditing && (
        <PasswordInput
          label={t('form.password.label')}
          placeholder={t('form.password.placeholder')}
          required
          {...form.getInputProps('password')}
        />
      )}
      <RoleSelectField allowCreate {...form.getInputProps('roleId')} />
    </FormColumn>
  )
}
