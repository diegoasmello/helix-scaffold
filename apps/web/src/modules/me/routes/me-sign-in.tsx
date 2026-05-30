import { getMeProviders, postMeSetPassword } from '@helix/api-client/hooks'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  createStyles,
  css,
  Divider,
  Group,
  IconBrandApple,
  IconBrandFacebook,
  IconBrandGoogle,
  IconInfoCircle,
  IconKey,
  IconLock,
  notify,
  PasswordInput,
  Stack,
  Text,
  Title,
  useForm,
} from '@helix/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { authClient } from '../../../lib/authentication'
import type { LinkedAccount, SetPasswordFormValues } from '../types'
import { setPasswordFormValidate } from '../validation'

const PROVIDER_DISPLAY: Record<
  string,
  { label: string; icon: React.ElementType }
> = {
  google: { label: 'Google', icon: IconBrandGoogle },
  facebook: { label: 'Facebook', icon: IconBrandFacebook },
  apple: { label: 'Apple', icon: IconBrandApple },
  credential: { label: 'Email & Password', icon: IconLock },
}

const ME_ACCOUNTS_QUERY_KEY = ['me', 'accounts'] as const

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const useStyles = createStyles(() => ({
  flex: css`
    flex: 1;
  `,
}))

export function MeSignIn() {
  const { classes } = useStyles()
  const queryClient = useQueryClient()
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)

  const {
    data: accounts = [],
    isPending: accountsLoading,
    isError: accountsError,
  } = useQuery({
    queryKey: ME_ACCOUNTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts()
      if (error) throw error
      return (data ?? []) as LinkedAccount[]
    },
  })

  const {
    data: { providers: availableProviders = [] } = {},
    isError: providersError,
  } = useQuery({
    queryKey: ['me', 'providers'],
    queryFn: () => getMeProviders(),
  })

  const linkedProviderIds = new Set(accounts.map((a) => a.providerId))
  const unlinkableProviders = availableProviders.filter(
    (p) => !linkedProviderIds.has(p)
  )

  const hasPassword = accounts.some((a) => a.providerId === 'credential')

  const { mutate: setPassword, isPending: settingPassword } = useMutation({
    mutationFn: (data: { newPassword: string }) => postMeSetPassword(data),
    onSuccess: () => {
      form.reset()
      notify({ status: 'success', message: 'Password set successfully' })
      queryClient.invalidateQueries({ queryKey: ME_ACCOUNTS_QUERY_KEY })
    },
    onError: () => {
      notify({ status: 'danger', message: 'Failed to set password' })
    },
  })

  const form = useForm<SetPasswordFormValues>({
    initialValues: { newPassword: '', confirmPassword: '' },
    validate: setPasswordFormValidate,
  })

  const handleSubmit = form.onSubmit((values) => {
    setPassword({ newPassword: values.newPassword })
  })

  async function handleLink(provider: string) {
    setLinkingProvider(provider)
    try {
      const { error } = await authClient.linkSocial({
        provider: provider as 'google' | 'facebook' | 'apple',
        callbackURL: window.location.origin + '/me/sign-in',
      })
      if (error) throw error
    } catch {
      notify({
        status: 'danger',
        message: 'Could not link this account. Please try again.',
      })
    } finally {
      setLinkingProvider(null)
    }
  }

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4} lh={1.2}>
          Sign-in methods
        </Title>
        <Text c="dimmed" size="xs">
          Manage how you sign in to your account.
        </Text>
      </Stack>

      <Stack gap="md">
        <Title order={5}>Connected accounts</Title>
        {accountsError ? (
          <Alert icon={<IconInfoCircle size={16} />} color="red">
            Could not load your connected accounts. Please refresh the page.
          </Alert>
        ) : accountsLoading ? (
          <Text size="sm" c="dimmed">
            Loading…
          </Text>
        ) : accounts.length === 0 ? (
          <Text size="sm" c="dimmed">
            No accounts found.
          </Text>
        ) : (
          <Stack gap="xs">
            {accounts.map((account) => {
              const display =
                PROVIDER_DISPLAY[account.providerId] ??
                ({ label: account.providerId, icon: IconKey } as {
                  label: string
                  icon: React.ElementType
                })
              const Icon = display.icon
              return (
                <Group key={account.id} gap="sm">
                  <Icon size={20} />
                  <Stack gap={0} className={classes.flex}>
                    <Text size="sm" fw={500}>
                      {display.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Connected {formatDate(account.createdAt)}
                    </Text>
                  </Stack>
                  <Badge variant="light" color="green" size="sm">
                    Active
                  </Badge>
                </Group>
              )
            })}
          </Stack>
        )}
      </Stack>

      {!providersError && unlinkableProviders.length > 0 && (
        <Stack gap="md">
          <Title order={5}>Link another account</Title>
          <Text size="sm" c="dimmed">
            Connect a social provider so you can sign in with it in the future.
          </Text>
          <Stack gap="xs">
            {unlinkableProviders.map((provider) => {
              const display = PROVIDER_DISPLAY[provider] ?? {
                label: provider,
                icon: IconKey,
              }
              const Icon = display.icon
              return (
                <Group key={provider} gap="sm">
                  <Icon size={20} />
                  <Text size="sm" fw={500} className={classes.flex}>
                    {display.label}
                  </Text>
                  <Button
                    size="xs"
                    variant="default"
                    loading={linkingProvider === provider}
                    disabled={
                      linkingProvider !== null && linkingProvider !== provider
                    }
                    onClick={() => handleLink(provider)}
                  >
                    Connect
                  </Button>
                </Group>
              )
            })}
          </Stack>
        </Stack>
      )}

      <Divider />

      <Stack gap="md">
        <Title order={5}>Password</Title>
        {!accountsLoading &&
          !accountsError &&
          (hasPassword ? (
            <Alert icon={<IconInfoCircle size={16} />} color="blue">
              Your account has a password set.{' '}
              <Anchor href="/me/security" size="sm">
                Change password
              </Anchor>
            </Alert>
          ) : (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                You signed up via a social provider and have no password yet.
                Set one to also be able to sign in with your email address.
              </Text>
              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  <PasswordInput
                    label="New Password"
                    placeholder="At least 8 characters"
                    required
                    {...form.getInputProps('newPassword')}
                  />
                  <PasswordInput
                    label="Confirm Password"
                    placeholder="Repeat your password"
                    required
                    {...form.getInputProps('confirmPassword')}
                  />
                  <Group justify="flex-end">
                    <Button type="submit" loading={settingPassword}>
                      Set password
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Stack>
          ))}
      </Stack>
    </Stack>
  )
}
