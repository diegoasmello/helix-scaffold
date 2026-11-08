import './config/upload-references'

import { fastifyCors } from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
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
import { type Config, config as defaultConfig } from './config'
import { billingWebhookAdapter as configuredBillingWebhookAdapter } from './config/billing-webhook'
import type { Database } from './db'
import { env } from './env'
import { registerAuditRequest } from './hooks/audit-request'
import {
  isPublicApiUrl,
  PUBLIC_API_PREFIX,
  publicCorsOptions,
  registerPublicApi,
} from './hooks/public-api'
import { createRequireAuth } from './hooks/require-auth'
import { createRequirePermission } from './hooks/require-permission'
import { createRequireSubscription } from './hooks/require-subscription'
import { registerUntrustedProxyWarning } from './hooks/untrusted-proxy-warning'
import { API_PREFIX } from './lib/api-prefix'
import { registerDomainErrorHandler } from './lib/domain-errors'
import { createEmailProvider } from './lib/email'
import { registerNotFoundHandler, serializeRequest } from './lib/request-log'
import { createStorageProvider } from './lib/storage'
import { getUploadReferences } from './lib/upload-references'
import { createAuditRecorder } from './modules/audit/audit-recorder'
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
import { todosPublicRoutes } from './modules/todos/todos-public-routes'
import { todosRoutes } from './modules/todos/todos-routes'
import { uploadFilesRoutes } from './modules/uploads/upload-files-routes'
import { uploadsRoutes } from './modules/uploads/uploads-routes'
import { usersRoutes } from './modules/users/users-routes'

interface BuildAppOptions {
  /**
   * The settings every module receives. Defaults to `src/app.config.ts`
   * (`config` from `@/config`); tests pass another one built with
   * `overrideConfig()` to run in a different mode.
   */
  config?: Config
  /** Overrides src/config/billing-webhook.ts — used by tests. */
  billingWebhookAdapter?: BillingWebhookAdapter | null
}

export function buildApp(database: Database, options: BuildAppOptions = {}) {
  const {
    config = defaultConfig,
    billingWebhookAdapter = configuredBillingWebhookAdapter,
  } = options

  const app = fastify({
    trustProxy: config.server.trustProxy,
    logger: {
      level: config.logger.level,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      // Request URLs carry secrets (reset-password, verification and OAuth
      // tokens) — logged only through `redactUrl()`.
      serializers: { req: serializeRequest },
      transport: config.logger.pretty ? { target: 'pino-pretty' } : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>()

  const storage = createStorageProvider(config.uploads, env.BASE_URL)
  const emailProvider = createEmailProvider({
    enabled: config.email.enabled,
    resendApiKey: env.RESEND_API_KEY,
    from: config.email.from,
    nodeEnv: env.NODE_ENV,
  })
  const auth = createAuth(database, emailProvider, config, app.log)
  const audit = createAuditRecorder(createAuditService(database), app.log)

  // On the whole app: a forgotten `server.trustProxy` shows on any route.
  registerUntrustedProxyWarning(app)
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  // Before any route: every plugin inherits it.
  registerDomainErrorHandler(app)
  registerNotFoundHandler(app)

  app.register(fastifyMultipart, {
    limits: { fileSize: config.uploads.maxSizeMb * 1024 * 1024 },
  })

  // The web (`CLIENT_URL`, with its session cookie) everywhere but the
  // public API, which has its own origins and never takes credentials.
  const webCors = {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,
  }
  const publicCors = publicCorsOptions(config.publicApi)
  app.register(fastifyCors, {
    delegator: (request, callback) => {
      callback(null, isPublicApiUrl(request.url) ? publicCors : webCors)
    },
  })

  app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: config.app.name,
        version: '1.0.0',
      },
      // The paths are written without it (`stripBasePath`), so the client's
      // generated names stay `getUsers`, not `getApiUsers`.
      servers: [{ url: API_PREFIX }],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  })

  // Every route below is served under API_PREFIX (`/api/...`).
  app.register(
    async (api) => {
      api.register(ScalarApiReference, {
        routePrefix: '/docs',
      })

      api.register(async (instance) => {
        instance.addContentTypeParser(
          'application/json',
          { parseAs: 'string' },
          (_req, body, done) => {
            done(null, body)
          }
        )
        // Closed registration (403 on email sign-up) is enforced inside
        // better-auth, in `hooks.before` of `src/auth.ts`.
        // better-auth's default basePath, `/api/auth`, is this route.
        instance.all('/auth/*', async (request, reply) => {
          const rawBody = request.body as string | null
          // better-auth reads the client IP (sign-in rate limit, sessions)
          // from X-Forwarded-For. The client can send one, so it gets the IP
          // Fastify resolved under `server.trustProxy` instead.
          const headers = fromNodeHeaders(request.headers)
          headers.set('x-forwarded-for', request.ip)
          const webRequest = new Request(
            new URL(request.url, env.BASE_URL).toString(),
            {
              method: request.method,
              headers,
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

      api.register(bootstrapRoutes, { database, auth, config, audit })
      api.register(registrationRoutes, { config })
      api.register(subscriptionStatusRoutes, { config })

      // Reads the session itself: published files open to anyone.
      api.register(uploadFilesRoutes, {
        database,
        auth,
        config,
        storage,
        references: getUploadReferences(),
      })

      // What a site reads without signing in — see `src/hooks/public-api.ts`.
      if (config.publicApi.enabled) {
        api.register(
          async (publicApi) => {
            await registerPublicApi(publicApi, config.publicApi)

            publicApi.register(todosPublicRoutes, {
              database,
              baseUrl: env.BASE_URL,
            })
          },
          { prefix: PUBLIC_API_PREFIX }
        )
      }

      if (config.subscriptions.enabled && billingWebhookAdapter) {
        api.register(billingWebhookRoutes, {
          database,
          config,
          adapter: billingWebhookAdapter,
          audit,
        })
      }

      api.register(async (authenticated) => {
        authenticated.addHook('preHandler', createRequireAuth(auth))
        registerAuditRequest(authenticated, audit)

        const requirePermission = createRequirePermission(database)
        const requireSubscription = createRequireSubscription(database, config)

        authenticated.register(permissionsRoutes, {
          database,
          config,
          requirePermission,
        })
        authenticated.register(auditRoutes, { database, requirePermission })
        authenticated.register(meRoutes, {
          database,
          auth,
          config,
          emailProvider,
        })
        authenticated.register(rolesRoutes, { database, requirePermission })
        authenticated.register(usersRoutes, {
          database,
          auth,
          config,
          emailProvider,
          requirePermission,
        })

        authenticated.register(todosRoutes, {
          database,
          requirePermission,
          requireSubscription,
          storage,
          baseUrl: env.BASE_URL,
        })
        authenticated.register(uploadsRoutes, {
          database,
          requirePermission,
          storage,
        })

        if (config.subscriptions.enabled) {
          authenticated.register(subscriptionsRoutes, {
            database,
            config,
            requirePermission,
          })
        }
      })
    },
    { prefix: API_PREFIX }
  )

  return app
}
