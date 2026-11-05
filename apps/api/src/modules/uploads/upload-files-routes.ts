import path from 'node:path'

import fastifyStatic from '@fastify/static'
import type { FastifyRequest } from 'fastify'
import z from 'zod'

import type { Auth } from '@/auth'
import type { Config } from '@/config'
import type { Database } from '@/db'
import { publicCacheControl } from '@/hooks/public-api'
import { registerRateLimit } from '@/hooks/rate-limit'
import { readSessionUser } from '@/hooks/require-auth'
import type { StorageProvider } from '@/lib/storage'
import type {
  UploadReaderAccess,
  UploadReference,
} from '@/lib/upload-references'
import { createPermissionsService } from '@/modules/permissions/permissions-service'
import {
  createEntitlementsService,
  denialFor,
} from '@/modules/subscriptions/entitlements'

import type { FastifyTypedInstance } from '../../types'
import { createUploadsService } from './uploads-service'

type SessionUser = FastifyRequest['sessionUser']

// Content types a browser shows as passive content: no script runs in them.
const INLINE_TYPES = new Set(['application/pdf', 'text/plain'])
const INLINE_TYPE_FAMILIES = ['image/', 'audio/', 'video/']

/**
 * Whether a file served with this Content-Type may open in the browser. The
 * type comes from the file's extension, which the uploader chose, so anything
 * that can run script — HTML, SVG, any XML — must download instead.
 */
function opensInline(contentType: string): boolean {
  const type = contentType.split(';')[0].trim().toLowerCase()
  if (type.includes('xml')) return false
  return (
    INLINE_TYPES.has(type) ||
    INLINE_TYPE_FAMILIES.some((family) => type.startsWith(family))
  )
}

/**
 * `GET /files/*` — the stored files of uploads, for the users who may see
 * them: the uploader, `uploads:view`, or a reader of a record that references
 * the upload (`src/config/upload-references.ts`) — and, with
 * `publicApi.enabled`, anyone when a published record shows it (`isPublic`).
 *
 * Registered outside the `authenticated` scope, so it reads the session
 * itself: an anonymous request for a file that is not public gets 401.
 */
export async function uploadFilesRoutes(
  app: FastifyTypedInstance,
  {
    database,
    auth,
    config,
    storage,
    references,
  }: {
    database: Database
    auth: Auth
    config: Config
    storage: StorageProvider
    references: readonly UploadReference[]
  }
) {
  const uploadsService = createUploadsService(database, storage)
  const permissionsService = createPermissionsService(database)
  const entitlementsService = createEntitlementsService(
    database,
    config.subscriptions
  )

  async function hasPermission(
    user: SessionUser,
    resource: string,
    action: string
  ): Promise<boolean> {
    if (!user.roleId) return false
    return permissionsService.hasPermission(user.roleId, resource, action)
  }

  async function grants(
    user: SessionUser,
    access: UploadReaderAccess
  ): Promise<boolean> {
    if (!(await hasPermission(user, access.resource, access.action))) {
      return false
    }
    if (!config.subscriptions.enabled || access.subscription === undefined) {
      return true
    }
    const feature =
      access.subscription === true ? undefined : access.subscription
    return denialFor(await entitlementsService.forUser(user), feature) === null
  }

  /** Whether any of the checks passes — run together, not one by one. */
  async function anyOf(checks: Promise<boolean>[]): Promise<boolean> {
    return (await Promise.all(checks)).some(Boolean)
  }

  /** Whether a published record shows the upload — the same for everyone. */
  async function isPublic(uploadId: string): Promise<boolean> {
    if (!config.publicApi.enabled) return false
    return anyOf(
      references.flatMap((reference) =>
        reference.isPublic ? [reference.isPublic(database, uploadId)] : []
      )
    )
  }

  /** Whether `user` may read a record that holds the upload. */
  async function readsThroughReference(
    user: SessionUser,
    uploadId: string
  ): Promise<boolean> {
    return anyOf(
      references.map(
        async (reference) =>
          (await reference.references(database, uploadId)) &&
          (await grants(user, reference.access))
      )
    )
  }

  // The request's session, read once (the rate limit and the handler both
  // need it). A forged or expired cookie reads as no session.
  const sessions = new WeakMap<FastifyRequest, Promise<SessionUser | null>>()
  function sessionOf(request: FastifyRequest) {
    let session = sessions.get(request)
    if (!session) {
      session = readSessionUser(auth, request)
      sessions.set(request, session)
    }
    return session
  }

  // Anyone may call it: an anonymous request is counted per IP before the
  // upload is looked up. A signed-in user is not — the admin's thumbnails
  // must never get a 429, even when many users share one IP (an office, or a
  // proxy `server.trustProxy` does not know).
  await registerRateLimit(app, {
    ...config.uploads.rateLimit,
    allowList: async (request) => (await sessionOf(request)) !== null,
  })

  // Only for `reply.sendFile()`: the route below decides who gets a file.
  app.register(fastifyStatic, {
    root: path.resolve(config.uploads.dir),
    serve: false,
    // The route sets it: public for a published file, private otherwise.
    cacheControl: false,
  })

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff')
    // Only a public file (the handler says so) is the same for everyone; any
    // other answer depends on who asks, so a shared cache never keeps it.
    if (!reply.hasHeader('cache-control')) {
      reply.header('cache-control', 'private, max-age=0')
    }
    const contentType = String(reply.getHeader('content-type') ?? '')
    if (reply.statusCode < 300 && !opensInline(contentType)) {
      reply.header('content-disposition', 'attachment')
      reply.header('content-security-policy', "default-src 'none'; sandbox")
    }
    return payload
  })

  app.get(
    '/files/*',
    {
      schema: {
        hide: true,
        params: z.object({ '*': z.string() }),
      },
    },
    async (request, reply) => {
      const key = request.params['*']
      const upload = await uploadsService.getByFileKey(key)
      // Already read by the rate limit.
      const user = await sessionOf(request)
      // The cheap checks first — the admin's thumbnails stop here: the
      // uploader (no query) and `uploads:view` (one).
      if (
        upload &&
        user &&
        (upload.uploadedBy === user.id ||
          (await hasPermission(user, 'uploads', 'view')))
      ) {
        return reply.sendFile(key)
      }
      if (upload && (await isPublic(upload.id))) {
        reply.header('cache-control', publicCacheControl(config.publicApi))
        return reply.sendFile(key)
      }
      if (!user) {
        return reply.status(401).send({ message: 'Unauthorized' })
      }
      // A file the user may not read answers as if it did not exist.
      if (!upload || !(await readsThroughReference(user, upload.id))) {
        reply.callNotFound()
        return reply
      }
      return reply.sendFile(key)
    }
  )
}
