import {
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
import { signUpRoute } from '.'

interface SignUpFormValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function SignUp() {
  const navigate = signUpRoute.useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SignUpFormValues>({
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validate: {
      name: (v) => (!v.trim() ? 'Name is required' : null),
      email: (v) => (!v.trim() ? 'Email is required' : null),
      password: (v) =>
        v.length < 8 ? 'Password must be at least 8 characters' : null,
      confirmPassword: (v, values) =>
        v !== values.password ? 'Passwords do not match' : null,
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
      setServerError(error.message ?? 'Could not create account')
      return
    }

    await navigate({ to: '/' })
  }

  return (
    <Center h="100vh">
      <Paper withBorder shadow="md" p="xl" w={400} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Title order={3}>Create account</Title>
            <TextInput
              label="Name"
              placeholder="Your name"
              {...form.getInputProps('name')}
            />
            <TextInput
              label="Email"
              type="email"
              placeholder="you@example.com"
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Password"
              placeholder="At least 8 characters"
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label="Confirm password"
              placeholder="Repeat your password"
              {...form.getInputProps('confirmPassword')}
            />
            {serverError && (
              <Text c="red" size="sm">
                {serverError}
              </Text>
            )}
            <Button type="submit" fullWidth loading={form.submitting}>
              Create account
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
