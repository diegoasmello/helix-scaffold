import { env } from '../env'

export function getConfiguredSocialProviders(): string[] {
  const providers: string[] = []
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push('google')
  if (env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET)
    providers.push('facebook')
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) providers.push('apple')
  return providers
}
