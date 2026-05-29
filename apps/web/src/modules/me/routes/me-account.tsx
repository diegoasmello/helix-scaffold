import {
  getMeSuspenseQueryKey,
  patchMe,
  patchMeEmail,
  useGetMeSuspense,
} from '@helix/api-client/hooks'
import {
  Alert,
  Button,
  Group,
  notify,
  Stack,
  Text,
  TextInput,
  Title,
  useForm,
} from '@helix/ui'
import { IconInfoCircle } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type {
  EmailChangeFormValues,
  MeFormValues,
  UpdateMeEmailInput,
  UpdateMeInput,
} from '../types'
import { createEmailChangeFormValidate, meFormValidate } from '../validation'

export function MeAccount() {
  const { data: profile } = useGetMeSuspense()
  const queryClient = useQueryClient()
  const [emailChangePending, setEmailChangePending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  const { mutate: updateProfile, isPending: isUpdating } = useMutation({
    mutationFn: (data: UpdateMeInput) => patchMe(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(getMeSuspenseQueryKey(), updated)
      notify({ status: 'success', message: 'Name updated successfully' })
    },
    onError: () => {
      notify({ status: 'danger', message: 'Failed to update profile' })
    },
  })

  const { mutate: requestEmailChange, isPending: isRequestingEmail } =
    useMutation({
      mutationFn: (data: UpdateMeEmailInput) => patchMeEmail(data),
      onSuccess: (_, variables) => {
        setPendingEmail(variables.newEmail)
        setEmailChangePending(true)
        emailForm.reset()
      },
      onError: () => {
        notify({
          status: 'danger',
          message: 'Failed to send verification email',
        })
      },
    })

  const nameForm = useForm<MeFormValues>({
    initialValues: { name: profile.name },
    validate: meFormValidate,
  })

  const emailForm = useForm<EmailChangeFormValues>({
    initialValues: { newEmail: '' },
    validate: createEmailChangeFormValidate(profile.email),
  })

  return (
    <Stack gap="xl">
      <form onSubmit={nameForm.onSubmit((values) => updateProfile(values))}>
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={4} lh={1.2}>
              Name
            </Title>
            <Text c="dimmed" size="xs">
              Update your display name.
            </Text>
          </Stack>
          <TextInput
            label="Name"
            required
            {...nameForm.getInputProps('name')}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={isUpdating}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>

      <Stack gap="md">
        <Stack gap={4}>
          <Title order={4} lh={1.2}>
            Email Address
          </Title>
          <Text c="dimmed" size="xs">
            A verification link will be sent to your new address.
          </Text>
        </Stack>
        <TextInput label="Current email" value={profile.email} disabled />
        {emailChangePending ? (
          <Stack gap="xs">
            <Alert
              color="blue"
              icon={<IconInfoCircle size={16} />}
              title="Check your inbox"
            >
              We sent a verification link to <strong>{pendingEmail}</strong>.
              Click it to confirm your new email address.
            </Alert>
            <Group justify="flex-end">
              <Button
                variant="subtle"
                size="xs"
                onClick={() => setEmailChangePending(false)}
              >
                Use a different email
              </Button>
            </Group>
          </Stack>
        ) : (
          <form
            onSubmit={emailForm.onSubmit((values) =>
              requestEmailChange(values)
            )}
          >
            <Stack gap="md">
              <TextInput
                label="New email"
                type="email"
                required
                {...emailForm.getInputProps('newEmail')}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={isRequestingEmail}>
                  Request change
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Stack>
    </Stack>
  )
}
