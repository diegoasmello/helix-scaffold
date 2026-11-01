import { sql } from 'drizzle-orm'
import z from 'zod'

import { ALL_PERMISSIONS } from '@/config/permissions'

import type { Auth } from '../../auth'
import { config } from '../../config'
import type { Database } from '../../db'
import { rolePermissions, roles, user } from '../../db/schema'
import type { FastifyTypedInstance } from '../../types'

const bootstrapStatusSchema = z.object({
  bootstrapped: z.boolean(),
})

const bootstrapBodySchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
})

async function isBootstrapped(database: Database): Promise<boolean> {
  const [{ count }] = await database
    .select({ count: sql<number>`count(*)` })
    .from(user)
  return Number(count) > 0
}

export async function bootstrapRoutes(
  app: FastifyTypedInstance,
  { database, auth }: { database: Database; auth: Auth }
) {
  app.get(
    '/bootstrap/status',
    {
      schema: {
        tags: ['bootstrap'],
        description: 'Check whether the system has been bootstrapped',
        response: { 200: bootstrapStatusSchema },
      },
    },
    async () => ({ bootstrapped: await isBootstrapped(database) })
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
      if (await isBootstrapped(database)) {
        return reply
          .status(409)
          .send({ message: 'System already bootstrapped' })
      }

      const [adminRole] = await database
        .insert(roles)
        .values({ name: 'Admin', description: 'Full system access' })
        .returning()

      await database.insert(rolePermissions).values(
        ALL_PERMISSIONS.map(({ resource, action }) => ({
          roleId: adminRole.id,
          resource,
          action,
        }))
      )

      const result = await auth.api.signUpEmail({
        body: {
          name: request.body.name,
          email: request.body.email,
          password: request.body.password,
        },
      })

      await database
        .update(user)
        .set({ roleId: adminRole.id })
        .where(sql`${user.id} = ${result.user.id}`)

      if (config.registration.mode === 'open') {
        const [userRole] = await database
          .insert(roles)
          .values({
            name: 'User',
            description: 'Default role for self-registered users',
            isDefault: true,
          })
          .returning()

        await database.insert(rolePermissions).values([
          { roleId: userRole.id, resource: 'me', action: 'view' },
          { roleId: userRole.id, resource: 'me', action: 'edit' },
        ])
      }

      return reply
        .status(201)
        .send({ message: 'System bootstrapped successfully' })
    }
  )
}
