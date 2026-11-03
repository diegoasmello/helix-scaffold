import z from 'zod'

import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/lib/pagination'
import { sortingQuerySchema } from '@/lib/sorting'

const imageVariantSchema = z.object({
  key: z.string(),
  url: z.string(),
})

const imageVariantsSchema = z.object({
  thumbnail: imageVariantSchema,
  small: imageVariantSchema,
  medium: imageVariantSchema,
  large: imageVariantSchema,
})

export const uploadSchema = z
  .object({
    id: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    fileSize: z.number(),
    storageKey: z.string(),
    url: z.string(),
    variants: imageVariantsSchema.nullable(),
    uploadedBy: z.string().nullable(),
    createdAt: z.date(),
  })
  .meta({ id: 'Upload', title: 'Upload' })

const UPLOAD_SORT_COLUMNS = ['originalName', 'createdAt'] as const

const uploadsSortingSchema = sortingQuerySchema([...UPLOAD_SORT_COLUMNS])
export const uploadsListQuerySchema =
  paginationQuerySchema.merge(uploadsSortingSchema)
export type UploadsListQuery = z.infer<typeof uploadsListQuerySchema>

export const paginatedUploadsSchema = paginatedResponseSchema(
  uploadSchema
).meta({ id: 'PaginatedUploads', title: 'PaginatedUploads' })

export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
] as const
