import path from 'node:path'

import z from 'zod'

import type { Database } from '@/db'
import { isProcessableImage, processImage } from '@/lib/image-processor'
import { buildPaginatedResponse } from '@/lib/pagination'
import type { StorageProvider } from '@/lib/storage'

import type { FastifyTypedInstance, RequirePermission } from '../../types'
import {
  ALLOWED_MIME_TYPES,
  paginatedUploadsSchema,
  uploadSchema,
  uploadsListQuerySchema,
} from './uploads-schema'
import { createUploadsService } from './uploads-service'

export async function uploadsRoutes(
  app: FastifyTypedInstance,
  {
    database,
    requirePermission,
    storage,
  }: {
    database: Database
    requirePermission: RequirePermission
    storage: StorageProvider
  }
) {
  const service = createUploadsService(database, storage)

  app.post(
    '/uploads',
    {
      schema: {
        tags: ['uploads'],
        description: 'Upload a file',
        response: {
          201: uploadSchema,
          400: z.object({ message: z.string() }),
        },
        consumes: ['multipart/form-data'],
      },
      preHandler: requirePermission('uploads', 'create'),
    },
    async (request, reply) => {
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ message: 'No file provided' })
      }

      const mimeType = data.mimetype
      const allowedSet = new Set<string>(ALLOWED_MIME_TYPES)
      if (!allowedSet.has(mimeType)) {
        await data.toBuffer()
        return reply
          .status(400)
          .send({ message: `File type '${mimeType}' is not allowed` })
      }

      const buffer = await data.toBuffer()

      const id = crypto.randomUUID()
      const ext = path.extname(data.filename) || ''
      const originalKey = `${id}/original${ext}`

      let variants = null

      if (isProcessableImage(mimeType)) {
        const variantBuffers = await processImage(buffer)
        const variantKeys = {
          thumbnail: `${id}/thumbnail.webp`,
          small: `${id}/small.webp`,
          medium: `${id}/medium.webp`,
          large: `${id}/large.webp`,
        }
        await Promise.all([
          storage.save(
            variantKeys.thumbnail,
            variantBuffers.thumbnail,
            'image/webp'
          ),
          storage.save(variantKeys.small, variantBuffers.small, 'image/webp'),
          storage.save(variantKeys.medium, variantBuffers.medium, 'image/webp'),
          storage.save(variantKeys.large, variantBuffers.large, 'image/webp'),
        ])
        variants = {
          thumbnail: {
            key: variantKeys.thumbnail,
            url: storage.getUrl(variantKeys.thumbnail),
          },
          small: {
            key: variantKeys.small,
            url: storage.getUrl(variantKeys.small),
          },
          medium: {
            key: variantKeys.medium,
            url: storage.getUrl(variantKeys.medium),
          },
          large: {
            key: variantKeys.large,
            url: storage.getUrl(variantKeys.large),
          },
        }
      }

      await storage.save(originalKey, buffer, mimeType)

      const upload = await service.create({
        originalName: data.filename,
        mimeType,
        fileSize: buffer.length,
        storageKey: originalKey,
        url: storage.getUrl(originalKey),
        variants,
        uploadedBy: request.sessionUser.id,
      })

      await request.audit('create', 'uploads', upload.id, {
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        fileSize: upload.fileSize,
      })

      return reply.status(201).send(upload)
    }
  )

  app.get(
    '/uploads',
    {
      schema: {
        tags: ['uploads'],
        description: 'List uploads',
        querystring: uploadsListQuerySchema,
        response: { 200: paginatedUploadsSchema },
      },
      preHandler: requirePermission('uploads', 'view'),
    },
    async (request) => {
      const { data, total } = await service.list(request.query)
      return buildPaginatedResponse(data, total, request.query)
    }
  )

  app.get(
    '/uploads/:id',
    {
      schema: {
        tags: ['uploads'],
        description: 'Get an upload by id',
        params: z.object({ id: z.string() }),
        response: {
          200: uploadSchema,
          404: z.object({ message: z.string() }),
        },
      },
      preHandler: requirePermission('uploads', 'view'),
    },
    async (request, reply) => {
      const item = await service.getById(request.params.id)
      if (!item) return reply.status(404).send({ message: 'Upload not found' })
      return item
    }
  )

  app.delete(
    '/uploads/:id',
    {
      schema: {
        tags: ['uploads'],
        description: 'Delete an upload',
        params: z.object({ id: z.string() }),
        response: { 204: z.null().describe('Upload deleted') },
      },
      preHandler: requirePermission('uploads', 'delete'),
    },
    async (request, reply) => {
      await service.remove(request.params.id)
      await request.audit('delete', 'uploads', request.params.id)
      return reply.status(204).send(null)
    }
  )
}
