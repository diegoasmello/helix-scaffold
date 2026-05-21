import { patchMePassword } from '@helix/api-client/hooks'
import {
  Button,
  Group,
  notify,
  PasswordInput,
  Stack,
  Text,
  Title,
  useForm,
} from '@helix/ui'
import { useMutation } from '@tanstack/react-query'

import type { PasswordFormValues, UpdateMePasswordInput } from '../types'
import { passwordFormValidate } from '../validation'

export function MeSecurity() {
  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: (data: UpdateMePasswordInput) => patchMePassword(data),
    onSuccess: () => {
      form.reset()
      notify({ status: 'success', message: 'Password changed successfully' })
    },
    onError: () => {
      notify({ status: 'danger', message: 'Current password is incorrect' })
    },
  })

  const form = useForm<PasswordFormValues>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: passwordFormValidate,
  })

  const handleSubmit = form.onSubmit((values) => {
    changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
  })

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={4} lh={1.2}>
            Security
          </Title>
          <Text c="dimmed" size="xs">
            Choose a strong password with at least 8 characters.
          </Text>
        </Stack>
        <PasswordInput
          label="Current Password"
          required
          {...form.getInputProps('currentPassword')}
        />
        <PasswordInput
          label="New Password"
          required
          {...form.getInputProps('newPassword')}
        />
        <PasswordInput
          label="Confirm New Password"
          required
          {...form.getInputProps('confirmPassword')}
        />
        <Group justify="flex-end">
          <Button type="submit" loading={isPending}>
            Change Password
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
