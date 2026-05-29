import z from 'zod'

import { env } from '../../env'
import type { FastifyTypedInstance } from '../../types'

const registrationStatusSchema = z.object({
  open: z.boolean(),
})

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
    async () => ({ open: env.REGISTRATION_MODE === 'open' })
  )
}
