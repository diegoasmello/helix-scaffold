import { eq, sql } from 'drizzle-orm'
import z from 'zod'

import { ALL_PERMISSIONS } from '@/config/permissions'

import type { Auth } from '../../auth'
import { config } from '../../config'
import type { Database } from '../../db'
import { rolePermissions, roles, user } from '../../db/schema'
import { env } from '../../env'
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

  // Dev/test only — ensures the E2E test user exists with full admin permissions.
  // Safe to call multiple times; no-op if the user already has an admin role assigned.
  app.post(
    '/bootstrap/e2e-user',
    {
      schema: {
        tags: ['bootstrap'],
        description:
          'Ensure the E2E test user exists with admin role (dev/test only)',
        body: bootstrapBodySchema,
        response: {
          200: z.object({ message: z.string() }),
          201: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (env.NODE_ENV === 'production') {
        return reply
          .status(403)
          .send({ message: 'Not available in production' })
      }

      const [existingUser] = await database
        .select()
        .from(user)
        .where(eq(user.email, request.body.email))

      if (existingUser?.roleId) {
        return reply.status(200).send({ message: 'E2E user already set up' })
      }

      // Find or create an admin role with all permissions
      let [adminRole] = await database
        .select()
        .from(roles)
        .where(eq(roles.name, 'Admin'))

      if (!adminRole) {
        ;[adminRole] = await database
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
      }

      if (existingUser) {
        // User exists but has no role — just assign the admin role
        await database
          .update(user)
          .set({ roleId: adminRole.id })
          .where(eq(user.id, existingUser.id))
        return reply
          .status(200)
          .send({ message: 'E2E user updated with admin role' })
      }

      // Create the user then assign admin role
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

      return reply.status(201).send({ message: 'E2E user created' })
    }
  )
}
