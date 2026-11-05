import {
  Anchor,
  Button,
  Center,
  Divider,
  DocumentTitle,
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
import { signUpRoute } from '.'

interface SignUpFormValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function SignUp() {
  const navigate = signUpRoute.useNavigate()
  const { providers } = signUpRoute.useLoaderData()
  const [serverError, setServerError] = useState<string | null>(null)
  const { t } = useTranslation('auth')

  const form = useForm<SignUpFormValues>({
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validate: {
      name: (v) => (!v.trim() ? t('signUp.validation.nameRequired') : null),
      email: (v) => (!v.trim() ? t('signUp.validation.emailRequired') : null),
      password: (v) =>
        v.length < 8 ? t('signUp.validation.passwordLength') : null,
      confirmPassword: (v, values) =>
        v !== values.password ? t('signUp.validation.passwordsNoMatch') : null,
    },
  })

  async function handleSubmit(values: SignUpFormValues) {
    setServerError(null)

    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    })

    if (error) {
      setServerError(error.message ?? t('signUp.errors.couldNotCreate'))
      return
    }

    await navigate({ to: '/' })
  }

  return (
    <Center mih="100vh" px="md">
      <Paper withBorder p="xl" w="100%" maw={400} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <DocumentTitle title={t('signUp.title')} />
            <Title order={3}>{t('signUp.title')}</Title>
            <TextInput
              label={t('signUp.nameLabel')}
              placeholder={t('signUp.namePlaceholder')}
              required
              {...form.getInputProps('name')}
            />
            <TextInput
              label={t('signUp.emailLabel')}
              type="email"
              placeholder={t('signUp.emailPlaceholder')}
              required
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label={t('signUp.passwordLabel')}
              placeholder={t('signUp.passwordPlaceholder')}
              required
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label={t('signUp.confirmPasswordLabel')}
              placeholder={t('signUp.confirmPasswordPlaceholder')}
              required
              {...form.getInputProps('confirmPassword')}
            />
            {serverError && (
              <Text c="red" size="sm">
                {serverError}
              </Text>
            )}
            <Button type="submit" fullWidth loading={form.submitting}>
              {t('signUp.submitButton')}
            </Button>
            {providers.length > 0 && (
              <>
                <Divider label={t('login.orDivider')} labelPosition="center" />
                <SocialLoginButtons providers={providers} />
              </>
            )}
            <Text size="sm" ta="center">
              {t('signUp.haveAccount')}{' '}
              <Anchor href="/login">{t('signUp.signIn')}</Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
