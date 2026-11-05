import { beforeEach, describe, expect, it } from 'vitest'

import { uploads, user } from '@/db/schema'
import { cleanupUploads, cleanupUsers, testDb } from '@/test/helpers'

import { DomainError } from './domain-errors'
import { assertUsableUploads, IMAGE_TYPES, PDF_TYPES } from './upload-ownership'

// What a module's create and update check before writing a record that
// references uploads — on uploads alone, whichever modules exist. The route
// tests of a module with uploads cover its own fields (`describe('Upload
// ownership')`, `describe('Upload types')` in the reference module).

let author = ''
let someoneElse = ''

async function insertUser() {
  const id = crypto.randomUUID()
  await testDb.insert(user).values({
    id,
    name: 'Uploader',
    email: `uploader-${id}@test.com`,
  })
  return id
}

async function insertUpload(uploadedBy: string | null, mimeType: string) {
  const [upload] = await testDb
    .insert(uploads)
    .values({
      uploadedBy,
      originalName: 'file',
      mimeType,
      fileSize: 100,
      storageKey: `test/${crypto.randomUUID()}`,
      url: 'http://localhost:3333/api/files/test/file',
      variants: null,
    })
    .returning()
  return upload.id
}

async function refusal(promise: Promise<void>) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason
  )
  expect(error).toBeInstanceOf(DomainError)
  return (error as DomainError).code
}

beforeEach(async () => {
  await cleanupUploads()
  await cleanupUsers()
  author = await insertUser()
  someoneElse = await insertUser()
})

describe('assertUsableUploads', () => {
  it('accepts the uploads the actor uploaded', async () => {
    const id = await insertUpload(author, 'application/pdf')
    await expect(
      assertUsableUploads(testDb, author, [id])
    ).resolves.toBeUndefined()
  })

  it("refuses someone else's upload", async () => {
    const id = await insertUpload(someoneElse, 'application/pdf')
    expect(await refusal(assertUsableUploads(testDb, author, [id]))).toBe(
      'invalid_upload'
    )
  })

  it('refuses an unknown id the same way', async () => {
    expect(
      await refusal(
        assertUsableUploads(testDb, author, [`missing-${crypto.randomUUID()}`])
      )
    ).toBe('invalid_upload')
  })

  it('keeps what the record already references, whoever uploaded it', async () => {
    const id = await insertUpload(someoneElse, 'application/pdf')
    await expect(
      assertUsableUploads(testDb, author, [id], [id])
    ).resolves.toBeUndefined()
  })

  it('ignores empty references', async () => {
    await expect(
      assertUsableUploads(testDb, author, [
        null,
        undefined,
        { id: null, accept: PDF_TYPES },
      ])
    ).resolves.toBeUndefined()
  })

  it('accepts a type of the family a field accepts', async () => {
    const id = await insertUpload(author, 'image/svg+xml')
    await expect(
      assertUsableUploads(testDb, author, [{ id, accept: IMAGE_TYPES }])
    ).resolves.toBeUndefined()
  })

  it('refuses a type the field does not accept', async () => {
    const id = await insertUpload(author, 'application/pdf')
    expect(
      await refusal(
        assertUsableUploads(testDb, author, [{ id, accept: IMAGE_TYPES }])
      )
    ).toBe('invalid_upload_type')
  })

  it('checks the type of what the record already references too', async () => {
    const id = await insertUpload(someoneElse, 'image/png')
    expect(
      await refusal(
        assertUsableUploads(testDb, author, [{ id, accept: PDF_TYPES }], [id])
      )
    ).toBe('invalid_upload_type')
  })

  it('checks the owner before the type', async () => {
    const id = await insertUpload(someoneElse, 'application/pdf')
    expect(
      await refusal(
        assertUsableUploads(testDb, author, [{ id, accept: IMAGE_TYPES }])
      )
    ).toBe('invalid_upload')
  })
})
