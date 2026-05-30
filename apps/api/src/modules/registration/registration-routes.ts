import z from 'zod'

import { env } from '../../env'
import type { FastifyTypedInstance } from '../../types'

const registrationStatusSchema = z
  .object({
    open: z.boolean(),
    providers: z.array(z.string()),
  })
  .meta({ id: 'RegistrationStatus', title: 'RegistrationStatus' })

function getConfiguredProviders(): string[] {
  const providers: string[] = []
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push('google')
  if (env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET)
    providers.push('facebook')
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) providers.push('apple')
  return providers
}

export async function registrationRoutes(app: FastifyTypedInstance) {
  app.get(
    '/registration/status',
    {
      schema: {
        tags: ['registration'],
        description: 'Get the current registration mode',
        response: { 200: registrationStatusSchema },
      },
    },
    async () => ({
      open: env.REGISTRATION_MODE === 'open',
      providers:
        env.REGISTRATION_MODE === 'open' ? getConfiguredProviders() : [],
    })
  )
}
