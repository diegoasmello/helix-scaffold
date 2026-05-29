import type { UseFormReturnType } from '@helix/ui'
import { Grid, Switch, Text, Textarea, TextInput } from '@helix/ui'

import type { RoleFormValues } from '../types'

export interface RolesFormProps {
  form: UseFormReturnType<RoleFormValues>
}

export function RolesForm(props: Readonly<RolesFormProps>) {
  const { form } = props

  return (
    <Grid>
      <Grid.Col span={12}>
        <TextInput
          label="Name"
          placeholder="Role name"
          required
          {...form.getInputProps('name')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Textarea
          label="Description"
          placeholder="Role description"
          resize="vertical"
          required
          {...form.getInputProps('description')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Switch
          label="Default role for self-registration"
          description={
            <Text size="xs" c="dimmed">
              When open registration is enabled, new users are automatically
              assigned this role. Only one role can be the default.
            </Text>
          }
          {...form.getInputProps('isDefault', { type: 'checkbox' })}
        />
      </Grid.Col>
    </Grid>
  )
}
