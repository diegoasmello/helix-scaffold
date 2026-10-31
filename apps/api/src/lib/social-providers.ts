import { config } from '@/config'

export function getConfiguredSocialProviders(): string[] {
  return Object.entries(config.auth.socialProviders)
    .filter(([, provider]) => provider.enabled)
    .map(([name]) => name)
}
