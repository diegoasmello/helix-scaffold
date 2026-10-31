import path from 'node:path'

import { fastifyCors } from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
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
import { config } from './config'
import { billingWebhookAdapter as configuredBillingWebhookAdapter } from './config/billing-webhook'
import type { Database } from './db'
import { env } from './env'
import { registerAuditRequest } from './hooks/audit-request'
import { createRequireAuth } from './hooks/require-auth'
import { createRequirePermission } from './hooks/require-permission'
import { createRequireSubscription } from './hooks/require-subscription'
import { createEmailProvider } from './lib/email'
import { createStorageProvider } from './lib/storage'
import { auditRoutes } from './modules/audit/audit-routes'
import { createAuditService } from './modules/audit/audit-service'
import { billingWebhookRoutes } from './modules/billing-webhook/billing-webhook-routes'
import type { BillingWebhookAdapter } from './modules/billing-webhook/billing-webhook-types'
import { bootstrapRoutes } from './modules/bootstrap/bootstrap-routes'
import { meRoutes } from './modules/me/me-routes'
import { permissionsRoutes } from './modules/permissions/permissions-routes'
import { registrationRoutes } from './modules/registration/registration-routes'
import { rolesRoutes } from './modules/roles/roles-routes'
import { subscriptionStatusRoutes } from './modules/subscriptions/subscription-status-routes'
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions-routes'
import { todosRoutes } from './modules/todos/todos-routes'
import { uploadsRoutes } from './modules/uploads/uploads-routes'
import { usersRoutes } from './modules/users/users-routes'

interface BuildAppOptions {
  /** Overrides src/config/billing-webhook.ts — used by tests. */
  billingWebhookAdapter?: BillingWebhookAdapter | null
}

export function buildApp(database: Database, options: BuildAppOptions = {}) {
  const { billingWebhookAdapter = configuredBillingWebhookAdapter } = options

  const app = fastify({
    logger: {
      level: config.logger.level,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      transport: config.logger.pretty ? { target: 'pino-pretty' } : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>()

  const storage = createStorageProvider(config.uploads, env.BASE_URL)
  const emailProvider = createEmailProvider({
    resendApiKey: env.RESEND_API_KEY,
    from: config.email.from,
    nodeEnv: env.NODE_ENV,
  })
  const auth = createAuth(database, emailProvider)
  const auditService = createAuditService(database)

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.register(fastifyMultipart, {
    limits: { fileSize: config.uploads.maxSizeMb * 1024 * 1024 },
  })

  app.register(fastifyStatic, {
    root: path.resolve(config.uploads.dir),
    prefix: '/files/',
    decorateReply: false,
  })

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
        title: config.app.name,
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
    instance.addHook('onRequest', async (request, reply) => {
      if (
        request.method === 'POST' &&
        request.url.split('?')[0] === '/api/auth/sign-up/email' &&
        config.registration.mode !== 'open'
      ) {
        return reply.status(403).send({ message: 'Registration is closed' })
      }
    })
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
  app.register(registrationRoutes)
  app.register(subscriptionStatusRoutes)

  if (config.subscriptions.enabled && billingWebhookAdapter) {
    app.register(billingWebhookRoutes, {
      database,
      adapter: billingWebhookAdapter,
      auditService,
    })
  }

  app.register(async (authenticated) => {
    authenticated.addHook('preHandler', createRequireAuth(auth))
    registerAuditRequest(authenticated, auditService)

    const requirePermission = createRequirePermission(database)
    const requireSubscription = createRequireSubscription(database)

    authenticated.register(permissionsRoutes, { database, requirePermission })
    authenticated.register(auditRoutes, { database, requirePermission })
    authenticated.register(meRoutes, { database, auth, emailProvider })
    authenticated.register(rolesRoutes, { database, requirePermission })
    authenticated.register(usersRoutes, { database, auth, requirePermission })

    authenticated.register(todosRoutes, {
      database,
      requirePermission,
      requireSubscription,
      storage,
    })
    authenticated.register(uploadsRoutes, {
      database,
      requirePermission,
      storage,
    })

    if (config.subscriptions.enabled) {
      authenticated.register(subscriptionsRoutes, {
        database,
        requirePermission,
      })
    }
  })

  return app
}
