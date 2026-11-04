import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

import type { SlugConfig } from '../../lib/slug'
import { uploads } from './uploads'

export const todoStatusEnum = pgEnum('todo_status', ['pending', 'completed'])

export const todos = pgTable(
  'todos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    title: text('title').notNull(),
    // URL identifier for public pages (see `TODO_SLUG`): generated from `title`
    // on create, never changed, never accepted in a request body. Unique through
    // `todos_slug_unique` below.
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    // Searchable copies of `title`/`description` (see `TODO_NORMALIZED_FIELDS`).
    // Never returned by the API.
    normalizedTitle: text('normalized_title').notNull(),
    normalizedDescription: text('normalized_description').notNull(),
    content: text('content').notNull(),
    status: todoStatusEnum('status').default('pending').notNull(),
    date: timestamp('date').notNull(),
    fileId: text('file_id').references(() => uploads.id, {
      onDelete: 'set null',
    }),
    imageId: text('image_id').references(() => uploads.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    // `text_pattern_ops`: besides `=` (`getBySlug`), the index serves the
    // prefix lookup of `uniqueSlug()`, which the default operator class cannot
    // under a non-C collation (the whole index would be read).
    uniqueIndex('todos_slug_unique').on(t.slug.op('text_pattern_ops')),
    // Every foreign key gets an index (Postgres creates none): deleting an
    // upload sets these columns to null, and `GET /files/*` and the orphan
    // cleanup look records up by upload id (`src/config/upload-references.ts`).
    index('todos_file_id_idx').on(t.fileId),
    index('todos_image_id_idx').on(t.imageId),
  ]
)

/**
 * The text fields of `todos` with a normalized copy (`src/lib/normalize-text.ts`):
 * every write fills it with `normalizedValues(data, TODO_NORMALIZED_FIELDS)` —
 * the service, the seed and the tests' `todoRow()`. Search and the text filters
 * read it. A new normalized column goes in the table above and here.
 */
export const TODO_NORMALIZED_FIELDS = {
  title: 'normalizedTitle',
  description: 'normalizedDescription',
} as const satisfies Record<string, keyof typeof todos.$inferInsert>

/**
 * The slug of `todos` (`src/lib/slug.ts`): the service creates it from
 * `title` with `withUniqueSlug(database, TODO_SLUG, title, insert)`; the seed
 * uses `distinctSlugs()`, the tests' `todoRow()` a random suffix.
 */
export const TODO_SLUG = {
  column: todos.slug,
  constraint: 'todos_slug_unique',
  fallback: 'todo',
} as const satisfies SlugConfig
