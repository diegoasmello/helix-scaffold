import type { UseFormReturnType } from '@helix/ui'
import { FormColumn, Switch, Textarea, TextInput } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import type { RoleFormValues } from '../types'

export interface RolesFormProps {
  form: UseFormReturnType<RoleFormValues>
}

/** The role's fields — create and edit pages, and `RoleCreateDrawer`. */
export function RolesForm(props: Readonly<RolesFormProps>) {
  const { form } = props
  const { t } = useTranslation('roles')

  return (
    <FormColumn>
      <TextInput
        label={t('form.name.label')}
        placeholder={t('form.name.placeholder')}
        required
        {...form.getInputProps('name')}
      />
      <Textarea
        label={t('form.description.label')}
        placeholder={t('form.description.placeholder')}
        resize="vertical"
        rows={3}
        required
        {...form.getInputProps('description')}
      />
      <Switch
        label={t('form.isDefault.label')}
        description={t('form.isDefault.description')}
        {...form.getInputProps('isDefault', { type: 'checkbox' })}
      />
    </FormColumn>
  )
}
