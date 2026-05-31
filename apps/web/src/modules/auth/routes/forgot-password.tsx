import {
  Anchor,
  Button,
  Center,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  useForm,
} from '@helix/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { authClient } from '../../../lib/authentication'

interface ForgotPasswordFormValues {
  email: string
}

export function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const { t } = useTranslation('auth')

  const form = useForm<ForgotPasswordFormValues>({
    initialValues: { email: '' },
    validate: {
      email: (v) =>
        !v.trim() ? t('forgotPassword.validation.emailRequired') : null,
    },
  })

  async function handleSubmit(values: ForgotPasswordFormValues) {
    setServerError(null)

    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: window.location.origin + '/reset-password',
    })

    if (error) {
      setServerError(t('forgotPassword.errors.genericError'))
      return
    }

    setSubmitted(true)
  }

  return (
    <Center h="100vh">
      <Paper withBorder shadow="md" p="xl" w={400} radius="md">
        {submitted ? (
          <Stack gap="md">
            <Title order={3}>{t('forgotPassword.successTitle')}</Title>
            <Text size="sm" c="dimmed">
              {t('forgotPassword.successDescription')}
            </Text>
            <Anchor href="/login" size="sm" ta="center">
              {t('forgotPassword.backToSignIn')}
            </Anchor>
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <Title order={3}>{t('forgotPassword.title')}</Title>
              <Text size="sm" c="dimmed">
                {t('forgotPassword.description')}
              </Text>
              <TextInput
                label={t('forgotPassword.emailLabel')}
                type="email"
                placeholder={t('forgotPassword.emailPlaceholder')}
                required
                {...form.getInputProps('email')}
              />
              {serverError && (
                <Text c="red" size="sm">
                  {serverError}
                </Text>
              )}
              <Button type="submit" fullWidth loading={form.submitting}>
                {t('forgotPassword.submitButton')}
              </Button>
              <Anchor href="/login" size="sm" ta="center">
                {t('forgotPassword.backToSignIn')}
              </Anchor>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  )
}
