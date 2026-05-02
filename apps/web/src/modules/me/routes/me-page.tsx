import {
  getMeSuspenseQueryKey,
  patchMe,
  patchMePassword,
  useGetMeSuspense,
} from '@helix/api-client/hooks'
import {
  Button,
  Group,
  notify,
  PageView,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useForm,
} from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type {
  MeFormValues,
  PasswordFormValues,
  UpdateMeInput,
  UpdateMePasswordInput,
} from '../types'
import { meFormValidate, passwordFormValidate } from '../validation'

export function MePage() {
  const { data: profile } = useGetMeSuspense()
  const queryClient = useQueryClient()

  const { mutate: updateProfile, isPending: isUpdatingProfile } = useMutation({
    mutationFn: (data: UpdateMeInput) => patchMe(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(getMeSuspenseQueryKey(), updated)
      notify({ status: 'success', message: 'Profile updated successfully' })
    },
    onError: () => {
      notify({ status: 'danger', message: 'Failed to update profile' })
    },
  })

  const { mutate: changePassword, isPending: isChangingPassword } = useMutation(
    {
      mutationFn: (data: UpdateMePasswordInput) => patchMePassword(data),
      onSuccess: () => {
        passwordForm.reset()
        notify({ status: 'success', message: 'Password changed successfully' })
      },
      onError: () => {
        notify({ status: 'danger', message: 'Current password is incorrect' })
      },
    }
  )

  const profileForm = useForm<MeFormValues>({
    initialValues: {
      name: profile.name,
      email: profile.email,
    },
    validate: meFormValidate,
  })

  const passwordForm = useForm<PasswordFormValues>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: passwordFormValidate,
  })

  const handleProfileSubmit = profileForm.onSubmit((values) => {
    updateProfile({ name: values.name, email: values.email })
  })

  const handlePasswordSubmit = passwordForm.onSubmit((values) => {
    changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
  })

  return (
    <PageView title="Profile">
      <Stack gap="xl">
        <Paper p="lg" withBorder>
          <Title order={3} mb="xs">
            Personal Info
          </Title>
          <Text c="dimmed" size="sm" mb="lg">
            Update your name and email address.
          </Text>
          <form onSubmit={handleProfileSubmit}>
            <Stack gap="md">
              <TextInput label="Name" {...profileForm.getInputProps('name')} />
              <TextInput
                label="Email"
                type="email"
                {...profileForm.getInputProps('email')}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={isUpdatingProfile}>
                  Save
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>

        <Paper p="lg" withBorder>
          <Title order={3} mb="xs">
            Change Password
          </Title>
          <Text c="dimmed" size="sm" mb="lg">
            Choose a strong password with at least 8 characters.
          </Text>
          <form onSubmit={handlePasswordSubmit}>
            <Stack gap="md">
              <PasswordInput
                label="Current Password"
                {...passwordForm.getInputProps('currentPassword')}
              />
              <PasswordInput
                label="New Password"
                {...passwordForm.getInputProps('newPassword')}
              />
              <PasswordInput
                label="Confirm New Password"
                {...passwordForm.getInputProps('confirmPassword')}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={isChangingPassword}>
                  Change Password
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </PageView>
  )
}
