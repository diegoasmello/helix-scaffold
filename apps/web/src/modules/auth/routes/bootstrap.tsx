import { postBootstrap } from '@helix/api-client/hooks'
import {
  Alert,
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
import { IconInfoCircle } from '@helix/ui'
import { useState } from 'react'

import { bootstrapRoute } from '.'

interface BootstrapFormValues {
  name: string
  email: string
  password: string
}

export function Bootstrap() {
  const navigate = bootstrapRoute.useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<BootstrapFormValues>({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      name: (v) => (!v.trim() ? 'Required' : null),
      email: (v) => (!v.trim() ? 'Required' : null),
      password: (v) => (v.length < 8 ? 'Min 8 characters' : null),
    },
  })

  async function handleSubmit(values: BootstrapFormValues) {
    setServerError(null)
    try {
      await postBootstrap(values)
      await navigate({ to: '/login' })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Setup failed')
    }
  }

  return (
    <Center h="100vh">
      <Paper withBorder shadow="md" p="xl" w={440} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <div>
              <Title order={3}>System Setup</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Create the first admin account to get started.
              </Text>
            </div>
            <Alert
              icon={<IconInfoCircle size={16} />}
              color="blue"
              variant="light"
            >
              This account will have full access to all system resources.
            </Alert>
            <TextInput
              label="Name"
              placeholder="Admin name"
              {...form.getInputProps('name')}
            />
            <TextInput
              label="Email"
              type="email"
              placeholder="admin@example.com"
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Password"
              placeholder="Min 8 characters"
              {...form.getInputProps('password')}
            />
            {serverError && (
              <Text c="red" size="sm">
                {serverError}
              </Text>
            )}
            <Button type="submit" fullWidth loading={form.submitting}>
              Create admin account
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
