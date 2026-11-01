import z from 'zod'

import { createAccountProvisioning } from '@/modules/accounts/account-provisioning'
import { type AuditRecorder, systemActor } from '@/modules/audit/audit-recorder'

import type { Auth } from '../../auth'
import type { Config } from '../../config'
import type { Database } from '../../db'
import type { FastifyTypedInstance } from '../../types'

const bootstrapStatusSchema = z.object({
  bootstrapped: z.boolean(),
})

const bootstrapBodySchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
})

export async function bootstrapRoutes(
  app: FastifyTypedInstance,
  {
    database,
    auth,
    config,
    audit,
  }: { database: Database; auth: Auth; config: Config; audit: AuditRecorder }
) {
  const provisioning = createAccountProvisioning(database, auth, config)

  app.get(
    '/bootstrap/status',
    {
      schema: {
        tags: ['bootstrap'],
        description: 'Check whether the system has been bootstrapped',
        response: { 200: bootstrapStatusSchema },
      },
    },
    async () => ({ bootstrapped: await provisioning.isBootstrapped() })
  )

  app.post(
    '/bootstrap',
    {
      schema: {
        tags: ['bootstrap'],
        description: 'Create the first admin user with full permissions',
        body: bootstrapBodySchema,
        response: {
          201: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const result = await provisioning.provisionFirstAdmin(request.body)
      if (result.status === 'already_bootstrapped') {
        return reply
          .status(409)
          .send({ message: 'System already bootstrapped' })
      }
      // No session yet: the system records the first admin.
      await audit.record(
        systemActor('bootstrap', 'Bootstrap', {
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        }),
        {
          action: 'create',
          resource: 'users',
          resourceId: result.userId,
          metadata: { name: request.body.name, email: request.body.email },
        }
      )
      return reply
        .status(201)
        .send({ message: 'System bootstrapped successfully' })
    }
  )
}
