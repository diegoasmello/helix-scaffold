import type { UseFormReturnType } from '@helix/ui'
import { Grid, PasswordInput, TextInput } from '@helix/ui'
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
    <Grid>
      <Grid.Col span={12}>
        <TextInput
          label={t('form.name.label')}
          placeholder={t('form.name.placeholder')}
          required
          {...form.getInputProps('name')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <TextInput
          label={t('form.email.label')}
          placeholder={t('form.email.placeholder')}
          type="email"
          required
          {...form.getInputProps('email')}
        />
      </Grid.Col>
      {!isEditing && (
        <Grid.Col span={12}>
          <PasswordInput
            label={t('form.password.label')}
            placeholder={t('form.password.placeholder')}
            required
            {...form.getInputProps('password')}
          />
        </Grid.Col>
      )}
      <Grid.Col span={12}>
        <RoleSelectField allowCreate {...form.getInputProps('roleId')} />
      </Grid.Col>
    </Grid>
  )
}
