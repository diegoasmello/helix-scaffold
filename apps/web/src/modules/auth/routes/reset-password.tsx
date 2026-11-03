import {
  Anchor,
  Button,
  Center,
  DocumentTitle,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
  useForm,
} from '@helix/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { authClient } from '../../../lib/authentication'
import { resetPasswordRoute } from '.'

interface ResetPasswordFormValues {
  newPassword: string
  confirmPassword: string
}

export function ResetPassword() {
  const navigate = resetPasswordRoute.useNavigate()
  const { token, error: tokenError } = resetPasswordRoute.useSearch()
  const [serverError, setServerError] = useState<string | null>(null)
  const { t } = useTranslation('auth')

  const form = useForm<ResetPasswordFormValues>({
    initialValues: { newPassword: '', confirmPassword: '' },
    validate: {
      newPassword: (v) =>
        !v
          ? t('resetPassword.validation.passwordRequired')
          : v.length < 8
            ? t('resetPassword.validation.passwordLength')
            : null,
      confirmPassword: (v, values) =>
        v !== values.newPassword
          ? t('resetPassword.validation.passwordsNoMatch')
          : null,
    },
  })

  if (!token) {
    return (
      <Center h="100vh">
        <Paper withBorder shadow="md" p="xl" w={400} radius="md">
          <Stack gap="md">
            <DocumentTitle title={t('resetPassword.invalidTitle')} />
            <Title order={3}>{t('resetPassword.invalidTitle')}</Title>
            <Text size="sm" c="dimmed">
              {tokenError === 'INVALID_TOKEN'
                ? t('resetPassword.expiredLink')
                : t('resetPassword.invalidLink')}
            </Text>
            <Anchor href="/forgot-password" size="sm" ta="center">
              {t('resetPassword.requestNewLink')}
            </Anchor>
          </Stack>
        </Paper>
      </Center>
    )
  }

  const handleSubmit = async (values: ResetPasswordFormValues) => {
    setServerError(null)

    const { error } = await authClient.resetPassword({
      newPassword: values.newPassword,
      token,
    })

    if (error) {
      setServerError(t('resetPassword.errors.failedReset'))
      return
    }

    await navigate({ to: '/login' })
  }

  return (
    <Center h="100vh">
      <Paper withBorder shadow="md" p="xl" w={400} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <DocumentTitle title={t('resetPassword.title')} />
            <Title order={3}>{t('resetPassword.title')}</Title>
            <PasswordInput
              label={t('resetPassword.newPasswordLabel')}
              placeholder={t('resetPassword.newPasswordPlaceholder')}
              required
              {...form.getInputProps('newPassword')}
            />
            <PasswordInput
              label={t('resetPassword.confirmPasswordLabel')}
              placeholder={t('resetPassword.confirmPasswordPlaceholder')}
              required
              {...form.getInputProps('confirmPassword')}
            />
            {serverError && (
              <Text c="red" size="sm">
                {serverError}
              </Text>
            )}
            <Button type="submit" fullWidth loading={form.submitting}>
              {t('resetPassword.submitButton')}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
