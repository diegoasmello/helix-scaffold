import { fastifyCors } from '@fastify/cors'
import { fastifySwagger } from '@fastify/swagger'
import ScalarApiReference from '@scalar/fastify-api-reference'
import { fromNodeHeaders } from 'better-auth/node'
import { fastify } from 'fastify'
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import { createAuth } from './auth'
import type { Database } from './db'
import { env } from './env'
import { registerAuditRequest } from './hooks/audit-request'
import { createRequireAuth } from './hooks/require-auth'
import { createRequirePermission } from './hooks/require-permission'
import { auditRoutes } from './modules/audit/audit-routes'
import { createAuditService } from './modules/audit/audit-service'
import { bootstrapRoutes } from './modules/bootstrap/bootstrap-routes'
import { meRoutes } from './modules/me/me-routes'
import { permissionsRoutes } from './modules/permissions/permissions-routes'
import { rolesRoutes } from './modules/roles/roles-routes'
import { usersRoutes } from './modules/users/users-routes'

export function buildApp(database: Database) {
  const app = fastify({
    logger: {
      level: 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      transport:
        env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>()

  const auth = createAuth(database)

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.register(fastifyCors, {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,
  })

  app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Helix API',
        version: '1.0.0',
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  })

  app.register(ScalarApiReference, {
    routePrefix: '/docs',
  })

  app.register(async (instance) => {
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_req, body, done) => {
        done(null, body)
      }
    )
    instance.all('/api/auth/*', async (request, reply) => {
      const rawBody = request.body as string | null
      const webRequest = new Request(
        new URL(request.url, env.BASE_URL).toString(),
        {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          body:
            request.method !== 'GET' && request.method !== 'HEAD'
              ? (rawBody ?? undefined)
              : undefined,
        }
      )

      const response = await auth.handler(webRequest)

      reply.status(response.status)
      response.headers.forEach((value, key) => {
        if (!key.toLowerCase().startsWith('access-control-')) {
          reply.header(key, value)
        }
      })

      return reply.send(await response.text())
    })
  })

  app.register(bootstrapRoutes, { database, auth })

  app.register(async (authenticated) => {
    authenticated.addHook('preHandler', createRequireAuth(auth))
    registerAuditRequest(authenticated, createAuditService(database))

    const requirePermission = createRequirePermission(database)

    authenticated.register(permissionsRoutes, { database, requirePermission })
    authenticated.register(auditRoutes, { database, requirePermission })
    authenticated.register(meRoutes, { database, auth })
    authenticated.register(rolesRoutes, { database, requirePermission })
    authenticated.register(usersRoutes, { database, auth, requirePermission })
  })

  return app
}
