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
  // Every foreign key gets an index: deleting a user sets it to null.
  (t) => [index('uploads_uploaded_by_idx').on(t.uploadedBy)]
)
