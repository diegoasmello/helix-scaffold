import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { uuidv7 } from 'uuidv7'

import type { Database } from '@/db'
import { uploads } from '@/db/schema'
import { processImage } from '@/lib/image-processor'
import type { StorageProvider } from '@/lib/storage'

const ASSETS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'seed-assets'
)

export async function createSeedUploads(
  database: Database,
  storage: StorageProvider,
  options: { imageCount?: number; fileCount?: number } = {}
): Promise<{ imageIds: string[]; fileIds: string[]; allIds: string[] }> {
  const { imageCount = 0, fileCount = 0 } = options

  const imageIds: string[] = []
  const fileIds: string[] = []

  if (imageCount > 0) {
    const imageBuffer = await fs.readFile(path.join(ASSETS_DIR, 'sample.jpg'))
    const variantBuffers = await processImage(imageBuffer)

    for (let i = 0; i < imageCount; i++) {
      const storageId = uuidv7()
      const originalKey = `${storageId}/original.jpg`
      const variantKeys = {
        thumbnail: `${storageId}/thumbnail.webp`,
        small: `${storageId}/small.webp`,
        medium: `${storageId}/medium.webp`,
        large: `${storageId}/large.webp`,
      }

      await Promise.all([
        storage.save(originalKey, imageBuffer, 'image/jpeg'),
        storage.save(
          variantKeys.thumbnail,
          variantBuffers.thumbnail,
          'image/webp'
        ),
        storage.save(variantKeys.small, variantBuffers.small, 'image/webp'),
        storage.save(variantKeys.medium, variantBuffers.medium, 'image/webp'),
        storage.save(variantKeys.large, variantBuffers.large, 'image/webp'),
      ])

      const [upload] = await database
        .insert(uploads)
        .values({
          originalName: 'sample.jpg',
          mimeType: 'image/jpeg',
          fileSize: imageBuffer.length,
          storageKey: originalKey,
          url: storage.getUrl(originalKey),
          variants: {
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
          },
        })
        .returning()

      imageIds.push(upload.id)
    }
  }

  if (fileCount > 0) {
    const pdfBuffer = await fs.readFile(path.join(ASSETS_DIR, 'sample.pdf'))

    for (let i = 0; i < fileCount; i++) {
      const storageId = uuidv7()
      const originalKey = `${storageId}/original.pdf`

      await storage.save(originalKey, pdfBuffer, 'application/pdf')

      const [upload] = await database
        .insert(uploads)
        .values({
          originalName: 'sample.pdf',
          mimeType: 'application/pdf',
          fileSize: pdfBuffer.length,
          storageKey: originalKey,
          url: storage.getUrl(originalKey),
          variants: null,
        })
        .returning()

      fileIds.push(upload.id)
    }
  }

  return { imageIds, fileIds, allIds: [...imageIds, ...fileIds] }
}
