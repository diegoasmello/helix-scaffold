import { getMeProviders } from '@helix/api-client/hooks'
import {
  Alert,
  Button,
  createStyles,
  css,
  FormSection,
  Group,
  IconBrandApple,
  IconBrandFacebook,
  IconBrandGoogle,
  IconInfoCircle,
  IconKey,
  IconLock,
  notify,
  Stack,
  StatusBadge,
  Text,
  Title,
} from '@helix/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { authClient } from '../../../lib/authentication'
import type { LinkedAccount } from '../types'

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  google: IconBrandGoogle,
  facebook: IconBrandFacebook,
  apple: IconBrandApple,
  credential: IconLock,
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

export function SignInMethods() {
  const { classes } = useStyles()
  const { t } = useTranslation('me')
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

  async function handleLink(provider: string) {
    setLinkingProvider(provider)
    try {
      const { error } = await authClient.linkSocial({
        provider: provider as 'google' | 'facebook' | 'apple',
        callbackURL: window.location.origin + '/me/security',
      })
      if (error) throw error
    } catch {
      notify({
        status: 'danger',
        message: t('signIn.errors.couldNotLink'),
      })
    } finally {
      setLinkingProvider(null)
    }
  }

  return (
    <FormSection
      title={t('signIn.sectionTitle')}
      description={t('signIn.sectionDescription')}
    >
      <Stack gap="xs">
        <Title order={5}>{t('signIn.connectedAccountsTitle')}</Title>
        {accountsError ? (
          <Alert icon={<IconInfoCircle size={16} />} color="red">
            {t('signIn.errors.loadFailed')}
          </Alert>
        ) : accountsLoading ? (
          <Text size="sm" c="dimmed">
            {t('signIn.loadingLabel')}
          </Text>
        ) : accounts.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('signIn.noAccountsLabel')}
          </Text>
        ) : (
          <Stack gap="xs">
            {accounts.map((account) => {
              const Icon = PROVIDER_ICONS[account.providerId] ?? IconKey
              const providerLabel = t(
                `signIn.providers.${account.providerId as 'google' | 'facebook' | 'apple' | 'credential'}`,
                { defaultValue: account.providerId }
              )
              return (
                <Group key={account.id} gap="sm">
                  <Icon size={20} />
                  <Stack gap={0} className={classes.flex}>
                    <Text size="sm" fw={500}>
                      {providerLabel}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('signIn.connectedLabel')}{' '}
                      {formatDate(account.createdAt)}
                    </Text>
                  </Stack>
                  <StatusBadge tone="success">
                    {t('signIn.activeLabel')}
                  </StatusBadge>
                </Group>
              )
            })}
          </Stack>
        )}
      </Stack>

      {!providersError && unlinkableProviders.length > 0 && (
        <Stack gap="md">
          <Stack gap={0}>
            <Title order={5}>{t('signIn.linkAnotherTitle')}</Title>
            <Text size="sm" c="dimmed">
              {t('signIn.linkAnotherDescription')}
            </Text>
          </Stack>
          <Stack gap="xs">
            {unlinkableProviders.map((provider) => {
              const Icon = PROVIDER_ICONS[provider] ?? IconKey
              const providerLabel = t(
                `signIn.providers.${provider as 'google' | 'facebook' | 'apple' | 'credential'}`,
                { defaultValue: provider }
              )
              return (
                <Group key={provider} gap="sm">
                  <Icon size={20} />
                  <Text size="sm" fw={500} className={classes.flex}>
                    {providerLabel}
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
                    {t('signIn.connectButton')}
                  </Button>
                </Group>
              )
            })}
          </Stack>
        </Stack>
      )}
    </FormSection>
  )
}
