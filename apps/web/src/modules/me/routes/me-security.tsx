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
import { useTranslation } from 'react-i18next'

import type { PasswordFormValues, UpdateMePasswordInput } from '../types'
import { passwordFormValidate } from '../validation'

export function MeSecurity() {
  const { t } = useTranslation('me')

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: (data: UpdateMePasswordInput) => patchMePassword(data),
    onSuccess: () => {
      form.reset()
      notify({
        status: 'success',
        message: t('security.notifications.changed'),
      })
    },
    onError: () => {
      notify({
        status: 'danger',
        message: t('security.notifications.incorrectCurrent'),
      })
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
            {t('security.sectionTitle')}
          </Title>
          <Text c="dimmed" size="xs">
            {t('security.sectionDescription')}
          </Text>
        </Stack>
        <PasswordInput
          label={t('security.currentPassword')}
          required
          {...form.getInputProps('currentPassword')}
        />
        <PasswordInput
          label={t('security.newPassword')}
          required
          {...form.getInputProps('newPassword')}
        />
        <PasswordInput
          label={t('security.confirmNewPassword')}
          required
          {...form.getInputProps('confirmPassword')}
        />
        <Group justify="flex-end">
          <Button type="submit" loading={isPending}>
            {t('security.changeButton')}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
