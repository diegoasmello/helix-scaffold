import type { UseFormReturnType } from '@helix/ui'
import { Grid, Switch, Textarea, TextInput } from '@helix/ui'
import { useTranslation } from 'react-i18next'

import type { RoleFormValues } from '../types'

export interface RolesFormProps {
  form: UseFormReturnType<RoleFormValues>
}

export function RolesForm(props: Readonly<RolesFormProps>) {
  const { form } = props
  const { t } = useTranslation('roles')

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
        <Textarea
          label={t('form.description.label')}
          placeholder={t('form.description.placeholder')}
          resize="vertical"
          required
          {...form.getInputProps('description')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Switch
          label={t('form.isDefault.label')}
          description={t('form.isDefault.description')}
          {...form.getInputProps('isDefault', { type: 'checkbox' })}
        />
      </Grid.Col>
    </Grid>
  )
}
