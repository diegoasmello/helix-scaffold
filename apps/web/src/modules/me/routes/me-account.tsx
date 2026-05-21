import {
  getMeSuspenseQueryKey,
  patchMe,
  useGetMeSuspense,
} from '@helix/api-client/hooks'
import {
  Button,
  Group,
  notify,
  Stack,
  Text,
  TextInput,
  Title,
  useForm,
} from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { MeFormValues, UpdateMeInput } from '../types'
import { meFormValidate } from '../validation'

export function MeAccount() {
  const { data: profile } = useGetMeSuspense()
  const queryClient = useQueryClient()

  const { mutate: updateProfile, isPending } = useMutation({
    mutationFn: (data: UpdateMeInput) => patchMe(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(getMeSuspenseQueryKey(), updated)
      notify({ status: 'success', message: 'Profile updated successfully' })
    },
    onError: () => {
      notify({ status: 'danger', message: 'Failed to update profile' })
    },
  })

  const form = useForm<MeFormValues>({
    initialValues: {
      name: profile.name,
      email: profile.email,
    },
    validate: meFormValidate,
  })

  const handleSubmit = form.onSubmit((values) => {
    updateProfile({ name: values.name, email: values.email })
  })

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={4} lh={1.2}>
            Account
          </Title>
          <Text c="dimmed" size="xs">
            Update your name and email address.
          </Text>
        </Stack>
        <TextInput label="Name" required {...form.getInputProps('name')} />
        <TextInput
          label="Email"
          type="email"
          required
          {...form.getInputProps('email')}
        />
        <Group justify="flex-end">
          <Button type="submit" loading={isPending}>
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
