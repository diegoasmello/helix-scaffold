import type { UseFormReturnType } from '@helix/ui'
import { FormSection, Stack, Switch, Textarea, TextInput } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import type { RoleFormValues } from '../types'

export interface RolesFormProps {
  form: UseFormReturnType<RoleFormValues>
}

/** The role's fields alone — used by `RoleCreateDrawer`. */
export function RolesFormFields(props: Readonly<RolesFormProps>) {
  const { form } = props
  const { t } = useTranslation('roles')

  return (
    <Stack gap={18}>
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
    </Stack>
  )
}

/** The role's fields as a form page section — create and edit pages. */
export function RolesForm(props: Readonly<RolesFormProps>) {
  const { form } = props
  const { t } = useTranslation('roles')

  return (
    <FormSection
      title={t('sections.basic')}
      description={t('sections.basicDescription')}
    >
      <RolesFormFields form={form} />
    </FormSection>
  )
}
