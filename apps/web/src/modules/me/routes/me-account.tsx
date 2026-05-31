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
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation('me')
  const { t: tc } = useTranslation('common')
  const [emailChangePending, setEmailChangePending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  const { mutate: updateProfile, isPending: isUpdating } = useMutation({
    mutationFn: (data: UpdateMeInput) => patchMe(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(getMeSuspenseQueryKey(), updated)
      notify({
        status: 'success',
        message: t('account.email.notifications.updated'),
      })
    },
    onError: () => {
      notify({
        status: 'danger',
        message: t('account.email.notifications.updateFailed'),
      })
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
          message: t('account.email.notifications.emailFailed'),
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
              {t('account.name.sectionTitle')}
            </Title>
            <Text c="dimmed" size="xs">
              {t('account.name.sectionDescription')}
            </Text>
          </Stack>
          <TextInput
            label={t('account.name.label')}
            required
            {...nameForm.getInputProps('name')}
          />
          <Group justify="flex-end">
            <Button type="submit" loading={isUpdating}>
              {tc('actions.save')}
            </Button>
          </Group>
        </Stack>
      </form>

      <Stack gap="md">
        <Stack gap={4}>
          <Title order={4} lh={1.2}>
            {t('account.email.sectionTitle')}
          </Title>
          <Text c="dimmed" size="xs">
            {t('account.email.sectionDescription')}
          </Text>
        </Stack>
        <TextInput
          label={t('account.email.currentLabel')}
          value={profile.email}
          disabled
        />
        {emailChangePending ? (
          <Stack gap="xs">
            <Alert
              color="blue"
              icon={<IconInfoCircle size={16} />}
              title={t('account.email.alertTitle')}
            >
              {t('account.email.alertMessage', { email: pendingEmail })}
            </Alert>
            <Group justify="flex-end">
              <Button
                variant="subtle"
                size="xs"
                onClick={() => setEmailChangePending(false)}
              >
                {t('account.email.changeDifferent')}
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
                label={t('account.email.newLabel')}
                type="email"
                required
                {...emailForm.getInputProps('newEmail')}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={isRequestingEmail}>
                  {tc('actions.requestChange')}
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Stack>
    </Stack>
  )
}
