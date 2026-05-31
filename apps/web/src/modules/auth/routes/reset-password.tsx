import {
  Anchor,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
  useForm,
} from '@helix/ui'
import { useState } from 'react'

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

  const form = useForm<ResetPasswordFormValues>({
    initialValues: { newPassword: '', confirmPassword: '' },
    validate: {
      newPassword: (v) =>
        !v
          ? 'Password is required'
          : v.length < 8
            ? 'Password must be at least 8 characters'
            : null,
      confirmPassword: (v, values) =>
        v !== values.newPassword ? 'Passwords do not match' : null,
    },
  })

  if (!token) {
    return (
      <Center h="100vh">
        <Paper withBorder shadow="md" p="xl" w={400} radius="md">
          <Stack gap="md">
            <Title order={3}>Invalid link</Title>
            <Text size="sm" c="dimmed">
              {tokenError === 'INVALID_TOKEN'
                ? 'This password reset link has expired.'
                : 'This password reset link is invalid or has expired.'}
            </Text>
            <Anchor href="/forgot-password" size="sm" ta="center">
              Request a new link
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
      setServerError('Failed to reset password. The link may have expired.')
      return
    }

    await navigate({ to: '/login' })
  }

  return (
    <Center h="100vh">
      <Paper withBorder shadow="md" p="xl" w={400} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Title order={3}>Reset your password</Title>
            <PasswordInput
              label="New password"
              placeholder="At least 8 characters"
              required
              {...form.getInputProps('newPassword')}
            />
            <PasswordInput
              label="Confirm password"
              placeholder="Repeat your new password"
              required
              {...form.getInputProps('confirmPassword')}
            />
            {serverError && (
              <Text c="red" size="sm">
                {serverError}
              </Text>
            )}
            <Button type="submit" fullWidth loading={form.submitting}>
              Reset password
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
