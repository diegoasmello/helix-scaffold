import type { UseFormReturnType } from '@helix/ui'
import { Grid, Textarea, TextInput } from '@helix/ui'

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
          {...form.getInputProps('name')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Textarea
          label="Description"
          placeholder="Role description"
          resize="vertical"
          {...form.getInputProps('description')}
        />
      </Grid.Col>
    </Grid>
  )
}
