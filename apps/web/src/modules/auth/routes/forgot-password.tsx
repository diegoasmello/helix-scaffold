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

import { authClient } from '../../../lib/authentication'

interface ForgotPasswordFormValues {
  email: string
}

export function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<ForgotPasswordFormValues>({
    initialValues: { email: '' },
    validate: {
      email: (v) => (!v.trim() ? 'Email is required' : null),
    },
  })

  async function handleSubmit(values: ForgotPasswordFormValues) {
    setServerError(null)

    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: window.location.origin + '/reset-password',
    })

    if (error) {
      setServerError('Something went wrong. Please try again.')
      return
    }

    setSubmitted(true)
  }

  return (
    <Center h="100vh">
      <Paper withBorder shadow="md" p="xl" w={400} radius="md">
        {submitted ? (
          <Stack gap="md">
            <Title order={3}>Check your inbox</Title>
            <Text size="sm" c="dimmed">
              If an account with that email exists, you'll receive a password
              reset link shortly.
            </Text>
            <Anchor href="/login" size="sm" ta="center">
              Back to sign in
            </Anchor>
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <Title order={3}>Forgot password?</Title>
              <Text size="sm" c="dimmed">
                Enter your email and we'll send you a link to reset your
                password.
              </Text>
              <TextInput
                label="Email"
                type="email"
                placeholder="you@example.com"
                required
                {...form.getInputProps('email')}
              />
              {serverError && (
                <Text c="red" size="sm">
                  {serverError}
                </Text>
              )}
              <Button type="submit" fullWidth loading={form.submitting}>
                Send reset link
              </Button>
              <Anchor href="/login" size="sm" ta="center">
                Back to sign in
              </Anchor>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  )
}
