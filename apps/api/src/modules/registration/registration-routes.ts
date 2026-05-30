import z from 'zod'

import { env } from '../../env'
import { getConfiguredSocialProviders } from '../../lib/social-providers'
import type { FastifyTypedInstance } from '../../types'

const registrationStatusSchema = z
  .object({
    open: z.boolean(),
    providers: z.array(z.string()),
  })
  .meta({ id: 'RegistrationStatus', title: 'RegistrationStatus' })

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
        env.REGISTRATION_MODE === 'open' ? getConfiguredSocialProviders() : [],
    })
  )
}
