import z from 'zod'

import type { Config } from '../../config'
import { getUsableSocialProviders } from '../../lib/social-providers'
import type { FastifyTypedInstance } from '../../types'

const registrationStatusSchema = z
  .object({
    open: z.boolean(),
    providers: z.array(z.string()),
    email: z
      .boolean()
      .describe(
        'Whether the API sends email (`email.enabled`). Without it there is no password reset, and only the admin changes their own email'
      ),
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
        description:
          'Get the current registration mode, the social providers and whether email is on',
        response: { 200: registrationStatusSchema },
      },
    },
    async () => ({
      open: config.registration.mode === 'open',
      providers: getUsableSocialProviders(config),
      email: config.email.enabled,
    })
  )
}
