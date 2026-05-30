import {
  Button,
  IconBrandApple,
  IconBrandFacebook,
  IconBrandGoogle,
  Stack,
  Text,
} from '@helix/ui'
import { useState } from 'react'

import { authClient } from '../../../lib/authentication'

interface SocialLoginButtonsProps {
  providers: string[]
}

const PROVIDER_CONFIG = {
  google: {
    label: 'Continue with Google',
    icon: IconBrandGoogle,
  },
  facebook: {
    label: 'Continue with Facebook',
    icon: IconBrandFacebook,
  },
  apple: {
    label: 'Continue with Apple',
    icon: IconBrandApple,
  },
} as const

type KnownProvider = keyof typeof PROVIDER_CONFIG

function isKnownProvider(provider: string): provider is KnownProvider {
  return provider in PROVIDER_CONFIG
}

export function SocialLoginButtons(props: Readonly<SocialLoginButtonsProps>) {
  const { providers } = props

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSocialLogin(provider: KnownProvider) {
    setError(null)
    setLoadingProvider(provider)

    try {
      await authClient.signIn.social({
        provider,
        callbackURL: window.location.origin + '/',
      })
    } catch {
      setError('Could not sign in with this provider. Please try again.')
    } finally {
      setLoadingProvider(null)
    }
  }

  const knownProviders = providers.filter(isKnownProvider)

  if (knownProviders.length === 0) return null

  return (
    <Stack gap="xs">
      {knownProviders.map((provider) => {
        const config = PROVIDER_CONFIG[provider]
        const Icon = config.icon
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
            {config.label}
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
