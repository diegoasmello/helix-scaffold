import { type AnyColumn, type SQL, sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

import { user } from './authentication'

export interface ImageVariant {
  key: string
  url: string
}

export interface ImageVariants {
  thumbnail: ImageVariant
  small: ImageVariant
  medium: ImageVariant
  large: ImageVariant
}

export const IMAGE_VARIANT_NAMES = [
  'thumbnail',
  'small',
  'medium',
  'large',
] as const satisfies readonly (keyof ImageVariants)[]

/**
 * The storage key of one image variant, `(variants -> 'small' ->> 'key')` —
 * the expression each `uploads_variant_<name>_key_idx` is built on. A query
 * looking an upload up by a variant key must use this exact expression (the
 * name as a literal, not a parameter), or the index cannot serve it and the
 * whole table is read: `GET /files/*` runs it for anyone.
 */
export function variantKey(
  variants: AnyColumn,
  name: (typeof IMAGE_VARIANT_NAMES)[number]
): SQL<string> {
  return sql<string>`(${variants} -> ${sql.raw(`'${name}'`)} ->> 'key')`
}

export const uploads = pgTable(
  'uploads',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull(),
    storageKey: text('storage_key').notNull(),
    url: text('url').notNull(),
    variants: jsonb('variants').$type<ImageVariants | null>().default(null),
    uploadedBy: text('uploaded_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Every foreign key gets an index: deleting a user sets it to null.
    index('uploads_uploaded_by_idx').on(t.uploadedBy),
    // `GET /files/*` finds the upload that owns a key — the original or a
    // variant — for every request, signed in or not (`getByFileKey()`), and
    // `uploadIdsInHtml()` does the same for the images of a rich text field.
    index('uploads_storage_key_idx').on(t.storageKey),
    ...IMAGE_VARIANT_NAMES.map((name) =>
      index(`uploads_variant_${name}_key_idx`).on(variantKey(t.variants, name))
    ),
  ]
)
