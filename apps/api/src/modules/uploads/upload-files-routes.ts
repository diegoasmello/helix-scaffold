import path from 'node:path'

import fastifyStatic from '@fastify/static'
import type { FastifyRequest } from 'fastify'
import z from 'zod'

import type { Config } from '@/config'
import type { Database } from '@/db'
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
 * the upload (`src/config/upload-references.ts`).
 */
export async function uploadFilesRoutes(
  app: FastifyTypedInstance,
  {
    database,
    config,
    storage,
    references,
  }: {
    database: Database
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

  async function mayRead(
    user: SessionUser,
    upload: { id: string; uploadedBy: string | null }
  ): Promise<boolean> {
    if (upload.uploadedBy === user.id) return true
    if (await hasPermission(user, 'uploads', 'view')) return true
    for (const reference of references) {
      if (
        (await reference.references(database, upload.id)) &&
        (await grants(user, reference.access))
      ) {
        return true
      }
    }
    return false
  }

  // Only for `reply.sendFile()`: the route below decides who gets a file.
  app.register(fastifyStatic, {
    root: path.resolve(config.uploads.dir),
    serve: false,
  })

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff')
    // Each answer depends on who asks: never kept by a shared cache.
    reply.header('cache-control', 'private, max-age=0')
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
      // A file the user may not read answers as if it did not exist.
      if (!upload || !(await mayRead(request.sessionUser, upload))) {
        reply.callNotFound()
        return reply
      }
      return reply.sendFile(key)
    }
  )
}
