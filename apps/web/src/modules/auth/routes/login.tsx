import {
  Anchor,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useForm,
} from '@helix/ui'
import { useState } from 'react'

import { authClient } from '../../../lib/authentication'
import { loginRoute } from '.'

interface LoginFormValues {
  email: string
  password: string
}

export function Login() {
  const navigate = loginRoute.useNavigate()
  const { registrationOpen } = loginRoute.useLoaderData()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (!v.trim() ? 'Email is required' : null),
      password: (v) => (!v.trim() ? 'Password is required' : null),
    },
  })

  async function handleSubmit(values: LoginFormValues) {
    setServerError(null)

    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setServerError(error.message ?? 'Invalid credentials')
      return
    }

    await navigate({ to: '/' })
  }

  return (
    <Center h="100vh">
      <Paper withBorder shadow="md" p="xl" w={400} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Title order={3}>Sign in</Title>
            <TextInput
              label="Email"
              type="email"
              placeholder="you@example.com"
              required
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              {...form.getInputProps('password')}
            />
            {serverError && (
              <Text c="red" size="sm">
                {serverError}
              </Text>
            )}
            <Button type="submit" fullWidth loading={form.submitting}>
              Sign in
            </Button>
            {registrationOpen && (
              <Text size="sm" ta="center">
                Don't have an account?{' '}
                <Anchor href="/sign-up">Create one</Anchor>
              </Text>
            )}
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
