import type { UseFormReturnType } from '@helix/ui'
import { Grid, PasswordInput, TextInput } from '@helix/ui'

import { RoleSelectField } from '../../roles/components/role-select-field'
import type { UserFormValues } from '../types'

export interface UsersFormProps {
  form: UseFormReturnType<UserFormValues>
  isEditing?: boolean
}

export function UsersForm(props: Readonly<UsersFormProps>) {
  const { form, isEditing } = props

  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput
          label="Name"
          placeholder="Full name"
          required
          {...form.getInputProps('name')}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <TextInput
          label="Email"
          placeholder="email@example.com"
          type="email"
          required
          {...form.getInputProps('email')}
        />
      </Grid.Col>
      {!isEditing && (
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <PasswordInput
            label="Password"
            placeholder="Min 8 characters"
            required
            {...form.getInputProps('password')}
          />
        </Grid.Col>
      )}
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <RoleSelectField
          value={form.values.roleId}
          onChange={(value) => form.setFieldValue('roleId', value)}
          error={form.errors.roleId}
        />
      </Grid.Col>
    </Grid>
  )
}
