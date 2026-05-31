import {
  Button,
  IconBrandApple,
  IconBrandFacebook,
  IconBrandGoogle,
  Stack,
  Text,
} from '@helix/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { authClient } from '../../../lib/authentication'

interface SocialLoginButtonsProps {
  providers: string[]
}

const PROVIDER_CONFIG = {
  google: { icon: IconBrandGoogle },
  facebook: { icon: IconBrandFacebook },
  apple: { icon: IconBrandApple },
} as const

type KnownProvider = keyof typeof PROVIDER_CONFIG

function isKnownProvider(provider: string): provider is KnownProvider {
  return provider in PROVIDER_CONFIG
}

export function SocialLoginButtons(props: Readonly<SocialLoginButtonsProps>) {
  const { providers } = props

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation('auth')

  async function handleSocialLogin(provider: KnownProvider) {
    setError(null)
    setLoadingProvider(provider)

    try {
      await authClient.signIn.social({
        provider,
        callbackURL: window.location.origin + '/',
      })
    } catch {
      setError(t('social.errors.providerError'))
    } finally {
      setLoadingProvider(null)
    }
  }

  const knownProviders = providers.filter(isKnownProvider)

  if (knownProviders.length === 0) return null

  const providerLabels: Record<KnownProvider, string> = {
    google: t('social.continueWithGoogle'),
    facebook: t('social.continueWithFacebook'),
    apple: t('social.continueWithApple'),
  }

  return (
    <Stack gap="xs">
      {knownProviders.map((provider) => {
        const { icon: Icon } = PROVIDER_CONFIG[provider]
        return (
          <Button
            key={provider}
            variant="default"
            fullWidth
            leftSection={<Icon size={18} />}
            loading={loadingProvider === provider}
            disabled={loadingProvider !== null && loadingProvider !== provider}
            onClick={() => handleSocialLogin(provider)}
          >
            {providerLabels[provider]}
          </Button>
        )
      })}
      {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}
    </Stack>
  )
}
