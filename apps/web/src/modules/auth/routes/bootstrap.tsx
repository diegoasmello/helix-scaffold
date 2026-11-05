import { postBootstrap } from '@helix/api-client/hooks'
import {
  Alert,
  Button,
  Center,
  DocumentTitle,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useForm,
} from '@helix/ui'
import { IconInfoCircle } from '@helix/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { bootstrapRoute } from '.'

interface BootstrapFormValues {
  name: string
  email: string
  password: string
}

export function Bootstrap() {
  const navigate = bootstrapRoute.useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const { t } = useTranslation('auth')

  const form = useForm<BootstrapFormValues>({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (v) => (!v.trim() ? t('bootstrap.validation.required') : null),
      email: (v) => (!v.trim() ? t('bootstrap.validation.required') : null),
      password: (v) =>
        v.length < 8 ? t('bootstrap.validation.minPassword') : null,
    },
  })

  async function handleSubmit(values: BootstrapFormValues) {
    setServerError(null)
    try {
      await postBootstrap(values)
      await navigate({ to: '/login' })
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : t('bootstrap.errors.setupFailed')
      )
    }
  }

  return (
    <Center mih="100vh" px="md">
      <Paper withBorder p="xl" w="100%" maw={440} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <div>
              <DocumentTitle title={t('bootstrap.title')} />
              <Title order={3}>{t('bootstrap.title')}</Title>
              <Text size="sm" c="dimmed" mt={4}>
                {t('bootstrap.description')}
              </Text>
            </div>
            <Alert
              icon={<IconInfoCircle size={16} />}
              color="blue"
              variant="light"
            >
              {t('bootstrap.alertMessage')}
            </Alert>
            <TextInput
              label={t('bootstrap.nameLabel')}
              placeholder={t('bootstrap.namePlaceholder')}
              required
              {...form.getInputProps('name')}
            />
            <TextInput
              label={t('bootstrap.emailLabel')}
              type="email"
              placeholder={t('bootstrap.emailPlaceholder')}
              required
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label={t('bootstrap.passwordLabel')}
              placeholder={t('bootstrap.passwordPlaceholder')}
              required
              {...form.getInputProps('password')}
            />
            {serverError && (
              <Text c="red" size="sm">
                {serverError}
              </Text>
            )}
            <Button type="submit" fullWidth loading={form.submitting}>
              {t('bootstrap.submitButton')}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
