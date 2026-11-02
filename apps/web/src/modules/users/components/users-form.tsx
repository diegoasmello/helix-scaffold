import type { UseFormReturnType } from '@helix/ui'
import { FormSection, PasswordInput, TextInput } from '@helix/ui'
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
    <>
      <FormSection
        title={t('sections.account')}
        description={t('sections.accountDescription')}
      >
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
      </FormSection>
      <FormSection
        title={t('sections.access')}
        description={t('sections.accessDescription')}
      >
        <RoleSelectField allowCreate {...form.getInputProps('roleId')} />
      </FormSection>
    </>
  )
}
