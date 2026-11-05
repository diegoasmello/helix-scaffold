import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { boolean, pgTable, text } from 'drizzle-orm/pg-core'

import type { Database } from '@/db'
import { uploads } from '@/db/schema'
import {
  hasRows,
  type UploadReaderAccess,
  type UploadReference,
} from '@/lib/upload-references'

import { testDb } from './helpers'

// Tables of the tests' own, for the infrastructure that works on any module's
// tables — the upload references of `GET /files/*` and the orphan cleanup —
// so it stays tested whichever modules exist. They are in no migration:
// `createScratchTables()` in `beforeAll`, `dropScratchTables()` in `afterAll`.
// The two shapes a module references uploads with
// (`src/modules/uploads/CLAUDE.md` → _Adding uploads to another module_):

/**
 * A record with a single-file column (`file_id`, `on delete set null`) and a
 * publication flag: its public schema would return the file, not the
 * attachments (`isPublic` on the file column only).
 */
export const testDocuments = pgTable('test_documents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  fileId: text('file_id').references(() => uploads.id, {
    onDelete: 'set null',
  }),
  published: boolean('published').notNull().default(false),
})

/** Its multi-file junction table (both sides `on delete cascade`). */
const testDocumentAttachments = pgTable('test_document_attachments', {
  documentId: text('document_id')
    .notNull()
    .references(() => testDocuments.id, { onDelete: 'cascade' }),
  uploadId: text('upload_id')
    .notNull()
    .references(() => uploads.id, { onDelete: 'cascade' }),
})

export async function dropScratchTables() {
  await testDb.execute(sql`drop table if exists test_document_attachments`)
  await testDb.execute(sql`drop table if exists test_documents`)
}

/** Creates them empty — dropping first what a crashed run left behind. */
export async function createScratchTables() {
  await dropScratchTables()
  await testDb.execute(sql`
    create table test_documents (
      id text primary key,
      file_id text references uploads (id) on delete set null,
      published boolean not null default false
    )
  `)
  await testDb.execute(sql`
    create table test_document_attachments (
      document_id text not null references test_documents (id) on delete cascade,
      upload_id text not null references uploads (id) on delete cascade
    )
  `)
}

/** A document holding the upload in its `file_id`, or as an attachment. */
export async function insertTestDocument(
  uploadId: string,
  column: 'file' | 'attachment',
  options: { published?: boolean } = {}
) {
  const [document] = await testDb
    .insert(testDocuments)
    .values({
      fileId: column === 'file' ? uploadId : null,
      published: options.published ?? false,
    })
    .returning()
  if (column === 'attachment') {
    await testDb
      .insert(testDocumentAttachments)
      .values({ documentId: document.id, uploadId })
  }
  return document
}

/**
 * Both columns as a module registers them in `src/config/upload-references.ts`,
 * read by the users `access` describes — and the file of a published document
 * by anyone (`isPublic`).
 */
export function testDocumentReferences(
  access: UploadReaderAccess
): UploadReference[] {
  return [
    {
      access,
      load: async (db: Database) => {
        const rows = await db
          .select({ id: testDocuments.fileId })
          .from(testDocuments)
          .where(isNotNull(testDocuments.fileId))
        return rows
          .map((row) => row.id)
          .filter((id): id is string => id !== null)
      },
      references: (db, uploadId) =>
        hasRows(
          db
            .select({ id: testDocuments.id })
            .from(testDocuments)
            .where(eq(testDocuments.fileId, uploadId))
            .limit(1)
        ),
      isPublic: (db, uploadId) =>
        hasRows(
          db
            .select({ id: testDocuments.id })
            .from(testDocuments)
            .where(
              and(
                eq(testDocuments.published, true),
                eq(testDocuments.fileId, uploadId)
              )
            )
            .limit(1)
        ),
    },
    {
      access,
      load: async (db: Database) => {
        const rows = await db
          .selectDistinct({ id: testDocumentAttachments.uploadId })
          .from(testDocumentAttachments)
        return rows.map((row) => row.id)
      },
      references: (db, uploadId) =>
        hasRows(
          db
            .select({ id: testDocumentAttachments.uploadId })
            .from(testDocumentAttachments)
            .where(eq(testDocumentAttachments.uploadId, uploadId))
            .limit(1)
        ),
    },
  ]
}
