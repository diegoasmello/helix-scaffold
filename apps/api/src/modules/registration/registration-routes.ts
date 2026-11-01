import z from 'zod'

import type { Config } from '../../config'
import { getUsableSocialProviders } from '../../lib/social-providers'
import type { FastifyTypedInstance } from '../../types'

const registrationStatusSchema = z
  .object({
    open: z.boolean(),
    providers: z.array(z.string()),
  })
  .meta({ id: 'RegistrationStatus', title: 'RegistrationStatus' })

export async function registrationRoutes(
  app: FastifyTypedInstance,
  { config }: { config: Config }
) {
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
      open: config.registration.mode === 'open',
      providers: getUsableSocialProviders(config),
    })
  )
}
