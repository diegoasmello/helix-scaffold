import {
  Anchor,
  Button,
  Center,
  Divider,
  DocumentTitle,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useForm,
} from '@helix/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { authClient } from '../../../lib/authentication'
import { SocialLoginButtons } from '../components/social-login-buttons'
import { loginRoute } from '.'

interface LoginFormValues {
  email: string
  password: string
}

export function Login() {
  const navigate = loginRoute.useNavigate()
  const { registrationOpen, providers } = loginRoute.useLoaderData()
  const { error: socialError } = loginRoute.useSearch()
  const [serverError, setServerError] = useState<string | null>(null)
  const { t } = useTranslation('auth')

  const form = useForm<LoginFormValues>({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (!v.trim() ? t('login.validation.emailRequired') : null),
      password: (v) =>
        !v.trim() ? t('login.validation.passwordRequired') : null,
    },
  })

  async function handleSubmit(values: LoginFormValues) {
    setServerError(null)

    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setServerError(t('login.errors.invalidCredentials'))
      return
    }

    await navigate({ to: '/' })
  }

  return (
    <Center mih="100vh" px="md">
      <Paper withBorder p="xl" w="100%" maw={400} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <DocumentTitle title={t('login.title')} />
            <Title order={3}>{t('login.title')}</Title>
            <TextInput
              label={t('login.emailLabel')}
              type="email"
              placeholder={t('login.emailPlaceholder')}
              required
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label={t('login.passwordLabel')}
              placeholder={t('login.passwordPlaceholder')}
              required
              {...form.getInputProps('password')}
            />
            <Group justify="flex-end" mt={-8}>
              <Anchor href="/forgot-password" size="xs">
                {t('login.forgotPassword')}
              </Anchor>
            </Group>
            {serverError && (
              <Text c="red" size="sm">
                {serverError}
              </Text>
            )}
            {socialError && !serverError && (
              <Text c="red" size="sm" role="alert">
                {socialError === 'account_not_linked'
                  ? t('social.errors.accountNotLinked')
                  : t('social.errors.providerError')}
              </Text>
            )}
            <Button type="submit" fullWidth loading={form.submitting}>
              {t('login.submitButton')}
            </Button>
            {registrationOpen && providers.length > 0 && (
              <>
                <Divider label={t('login.orDivider')} labelPosition="center" />
                <SocialLoginButtons providers={providers} />
              </>
            )}
            {registrationOpen && (
              <Text size="sm" ta="center">
                {t('login.noAccount')}{' '}
                <Anchor href="/sign-up">{t('login.createOne')}</Anchor>
              </Text>
            )}
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
