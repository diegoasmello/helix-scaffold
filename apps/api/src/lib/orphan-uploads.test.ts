import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { uploads } from '@/db/schema'
import type { StorageProvider } from '@/lib/storage'
import { cleanupUploads, testDb } from '@/test/helpers'
import {
  createScratchTables,
  dropScratchTables,
  insertTestDocument,
  testDocumentReferences,
} from '@/test/scratch-tables'

import { deleteOrphanUploads } from './orphan-uploads'

function createMockStorage(): StorageProvider & { deletedKeys: string[] } {
  const deletedKeys: string[] = []
  return {
    save: async () => {},
    delete: async (key) => {
      deletedKeys.push(key)
    },
    getUrl: (key) => `http://mock/${key}`,
    deletedKeys,
  }
}

const GRACE_HOURS = 1
const OLD_DATE = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago, beyond grace period
const RECENT_DATE = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago, within grace period

async function insertUpload(overrides?: Partial<typeof uploads.$inferInsert>) {
  const [upload] = await testDb
    .insert(uploads)
    .values({
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1000,
      storageKey: `${crypto.randomUUID()}/original.jpg`,
      url: 'http://localhost/api/files/test.jpg',
      createdAt: OLD_DATE,
      ...overrides,
    })
    .returning()
  return upload
}

// A single-file column and a junction table, as a module registers them
const loaders = testDocumentReferences({
  resource: 'audit',
  action: 'view',
}).map((reference) => reference.load)

beforeAll(async () => {
  await createScratchTables()
})

afterAll(async () => {
  await dropScratchTables()
})

beforeEach(async () => {
  await cleanupUploads()
})

describe('deleteOrphanUploads', () => {
  it('deletes an orphan upload older than the grace period', async () => {
    const storage = createMockStorage()
    const upload = await insertUpload()

    const { deleted } = await deleteOrphanUploads(testDb, storage, loaders, {
      graceHours: GRACE_HOURS,
    })

    expect(deleted).toBe(1)
    expect(storage.deletedKeys).toContain(upload.storageKey)

    const remaining = await testDb.select().from(uploads)
    expect(remaining).toHaveLength(0)
  })

  it('does not delete an upload newer than the grace period', async () => {
    const storage = createMockStorage()
    await insertUpload({ createdAt: RECENT_DATE })

    const { deleted } = await deleteOrphanUploads(testDb, storage, loaders, {
      graceHours: GRACE_HOURS,
    })

    expect(deleted).toBe(0)
    expect(storage.deletedKeys).toHaveLength(0)
  })

  it('does not delete an upload referenced by a junction table', async () => {
    const storage = createMockStorage()
    const upload = await insertUpload()

    await insertTestDocument(upload.id, 'attachment')

    const { deleted } = await deleteOrphanUploads(testDb, storage, loaders, {
      graceHours: GRACE_HOURS,
    })

    expect(deleted).toBe(0)
    expect(storage.deletedKeys).toHaveLength(0)
  })

  it('does not delete an upload referenced by a direct FK column', async () => {
    const storage = createMockStorage()
    const upload = await insertUpload()

    await insertTestDocument(upload.id, 'file')

    const { deleted } = await deleteOrphanUploads(testDb, storage, loaders, {
      graceHours: GRACE_HOURS,
    })

    expect(deleted).toBe(0)
    expect(storage.deletedKeys).toHaveLength(0)
  })

  it('deletes only orphaned uploads when referenced and orphaned coexist', async () => {
    const storage = createMockStorage()
    const orphan = await insertUpload()
    const referenced = await insertUpload()

    await insertTestDocument(referenced.id, 'file')

    const { deleted } = await deleteOrphanUploads(testDb, storage, loaders, {
      graceHours: GRACE_HOURS,
    })

    expect(deleted).toBe(1)
    expect(storage.deletedKeys).toContain(orphan.storageKey)
    expect(storage.deletedKeys).not.toContain(referenced.storageKey)
  })

  it('deletes image variant storage keys alongside the original', async () => {
    const storage = createMockStorage()
    const id = crypto.randomUUID()
    await insertUpload({
      storageKey: `${id}/original.jpg`,
      variants: {
        thumbnail: {
          key: `${id}/thumbnail.webp`,
          url: 'http://mock/thumbnail',
        },
        small: { key: `${id}/small.webp`, url: 'http://mock/small' },
        medium: { key: `${id}/medium.webp`, url: 'http://mock/medium' },
        large: { key: `${id}/large.webp`, url: 'http://mock/large' },
      },
    })

    await deleteOrphanUploads(testDb, storage, loaders, {
      graceHours: GRACE_HOURS,
    })

    expect(storage.deletedKeys).toContain(`${id}/original.jpg`)
    expect(storage.deletedKeys).toContain(`${id}/thumbnail.webp`)
    expect(storage.deletedKeys).toContain(`${id}/small.webp`)
    expect(storage.deletedKeys).toContain(`${id}/medium.webp`)
    expect(storage.deletedKeys).toContain(`${id}/large.webp`)
  })

  it('returns deleted: 0 when no uploads exist', async () => {
    const storage = createMockStorage()
    const { deleted } = await deleteOrphanUploads(testDb, storage, loaders, {
      graceHours: GRACE_HOURS,
    })
    expect(deleted).toBe(0)
  })

  it('treats all old uploads as orphaned when no loaders are registered', async () => {
    const storage = createMockStorage()
    await insertUpload()

    const { deleted } = await deleteOrphanUploads(testDb, storage, [], {
      graceHours: GRACE_HOURS,
    })

    expect(deleted).toBe(1)
  })
})
