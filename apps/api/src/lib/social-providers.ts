import { config } from '@/config'

/** Providers enabled in `config.auth.socialProviders`, whatever the mode. */
export function getConfiguredSocialProviders(): string[] {
  return Object.entries(config.auth.socialProviders)
    .filter(([, provider]) => provider.enabled)
    .map(([name]) => name)
}

/**
 * Providers a user can actually use — to sign up, sign in or link an account.
 * None in closed mode, which is email/password only: the login page offers no
 * social button there, so a linked provider could never be used. Backs both
 * `GET /registration/status` and `GET /me/providers`.
 */
export function getUsableSocialProviders(): string[] {
  return config.registration.mode === 'open'
    ? getConfiguredSocialProviders()
    : []
}
