import { eq, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
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
    // A calendar day, not an instant: `date`, read and written as `YYYY-MM-DD`
    // (`mode: 'string'`), so it is the same day in every time zone.
    date: date('date', { mode: 'string' }).notNull(),
    // Shown by the public API (`todos-public-routes.ts`) — see
    // `TODO_PUBLISHED`. The admin turns it on and off.
    published: boolean('published').default(false).notNull(),
    // When it was first published: set by the service the first time
    // `published` turns on, never sent by a client, never changed or cleared
    // afterwards — the date a site shows and sorts by.
    publishedAt: timestamp('published_at', { withTimezone: true }),
    fileId: text('file_id').references(() => uploads.id, {
      onDelete: 'set null',
    }),
    imageId: text('image_id').references(() => uploads.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
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
    // A published row always has its date — whoever writes it (the service,
    // the seed, a test, an import).
    check(
      'todos_published_at_check',
      sql`not ${t.published} or ${t.publishedAt} is not null`
    ),
    // The public list (`todos-public-service.ts`): only published rows, in
    // the order of its default sort, `published_at desc, id desc` — `NULLS
    // FIRST` is Postgres' default for `desc`, so the query needs no clause.
    // Read backwards, it serves `published_at asc, id asc` too; a page stops
    // at its `LIMIT` instead of sorting every published row.
    index('todos_published_at_idx')
      .on(t.publishedAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(sql`${t.published}`),
  ]
)

/**
 * The rows the public API may show: `published`. Every public read — the
 * public service and the `isPublic` of the upload references — filters with
 * it, so "what is public" is decided in one place.
 */
export const TODO_PUBLISHED = eq(todos.published, true)

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
