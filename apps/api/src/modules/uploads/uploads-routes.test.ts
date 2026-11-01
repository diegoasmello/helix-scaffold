import fs from 'node:fs/promises'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { user } from '@/db/schema/authentication'
import { uploads } from '@/db/schema/uploads'
import {
  cleanupAuth,
  cleanupRoles,
  cleanupUploads,
  cleanupUsers,
  createRoleWithPermissions,
  createTestApp,
  createTestSession,
  findAuditLogs,
  testDb,
} from '@/test/helpers'

// --- helpers ---

function createMultipartBody(
  boundary: string,
  filename: string,
  mimeType: string,
  content: Buffer
): Buffer {
  const CRLF = '\r\n'
  const parts = [
    `--${boundary}${CRLF}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}`,
    `Content-Type: ${mimeType}${CRLF}`,
    CRLF,
  ]
  const header = Buffer.from(parts.join(''))
  const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
  return Buffer.concat([header, content, footer])
}

// 1x1 red PNG — minimal valid image file
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADklEQVQI12P4z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

const TINY_PDF = Buffer.from('%PDF-1.4\n%%EOF\n')

// ---

const app = createTestApp()
let authCookie = ''
let tmpUploadDir = ''

beforeAll(async () => {
  await cleanupAuth()
  authCookie = await createTestSession(app)
  // Capture upload dir from config for cleanup
  const { config } = await import('@/config')
  tmpUploadDir = path.resolve(config.uploads.dir)
})

beforeEach(async () => {
  await cleanupUploads()
})

afterEach(async () => {
  // Clean up any files created during the test
  try {
    const entries = await fs.readdir(tmpUploadDir)
    await Promise.all(
      entries.map((e) =>
        fs.rm(path.join(tmpUploadDir, e), { recursive: true, force: true })
      )
    )
  } catch {
    // directory may not exist yet
  }
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

it('returns 401 on any route when not authenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/uploads' })
  expect(res.statusCode).toBe(401)
})

describe('POST /uploads', () => {
  it('returns 201 and upload object for a valid image', async () => {
    const boundary = 'test-boundary'
    const body = createMultipartBody(
      boundary,
      'photo.png',
      'image/png',
      TINY_PNG
    )

    const res = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: {
        cookie: authCookie,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })
    expect(res.statusCode).toBe(201)
    const upload = res.json()
    expect(upload.originalName).toBe('photo.png')
    expect(upload.mimeType).toBe('image/png')
    expect(upload.fileSize).toBeGreaterThan(0)
    expect(upload.url).toContain('/files/')
    expect(upload.variants).not.toBeNull()
    expect(upload.variants.thumbnail.url).toContain('/files/')
    expect(upload.variants.small.url).toContain('/files/')
    expect(upload.variants.medium.url).toContain('/files/')
    expect(upload.variants.large.url).toContain('/files/')
  })

  it('returns 201 with null variants for a non-image file', async () => {
    const boundary = 'test-boundary-2'
    const body = createMultipartBody(
      boundary,
      'doc.pdf',
      'application/pdf',
      TINY_PDF
    )

    const res = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: {
        cookie: authCookie,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })
    expect(res.statusCode).toBe(201)
    const upload = res.json()
    expect(upload.mimeType).toBe('application/pdf')
    expect(upload.variants).toBeNull()
  })

  it('returns 400 for an unsupported MIME type', async () => {
    const boundary = 'test-boundary-3'
    const body = createMultipartBody(
      boundary,
      'file.exe',
      'application/x-msdownload',
      Buffer.from('MZ')
    )

    const res = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: {
        cookie: authCookie,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('not allowed')
  })

  it('returns 400 when no file is provided', async () => {
    const boundary = 'test-boundary-4'
    const body = Buffer.from(`--${boundary}--\r\n`)

    const res = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: {
        cookie: authCookie,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /uploads', () => {
  it('returns empty list when no uploads', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/uploads',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  })

  it('returns uploads when present', async () => {
    await testDb.insert(uploads).values({
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 100,
      storageKey: 'abc/original.pdf',
      url: 'http://localhost:3333/files/abc/original.pdf',
      variants: null,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/uploads',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.data[0].originalName).toBe('test.pdf')
  })
})

describe('GET /uploads/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/uploads/nonexistent',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns the upload when found', async () => {
    const [inserted] = await testDb
      .insert(uploads)
      .values({
        originalName: 'report.pdf',
        mimeType: 'application/pdf',
        fileSize: 200,
        storageKey: 'xyz/original.pdf',
        url: 'http://localhost:3333/files/xyz/original.pdf',
        variants: null,
      })
      .returning()

    const res = await app.inject({
      method: 'GET',
      url: `/uploads/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(inserted.id)
    expect(res.json().originalName).toBe('report.pdf')
  })
})

describe('DELETE /uploads/:id', () => {
  it('returns 204 for existing upload', async () => {
    const [inserted] = await testDb
      .insert(uploads)
      .values({
        originalName: 'to-delete.pdf',
        mimeType: 'application/pdf',
        fileSize: 50,
        storageKey: 'del/original.pdf',
        url: 'http://localhost:3333/files/del/original.pdf',
        variants: null,
      })
      .returning()

    const res = await app.inject({
      method: 'DELETE',
      url: `/uploads/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await findAuditLogs('delete', 'uploads', inserted.id)).toHaveLength(
      1
    )

    const [gone] = await testDb
      .select()
      .from(uploads)
      .where(eq(uploads.id, inserted.id))
    expect(gone).toBeUndefined()
  })

  it('returns 204 for unknown id (idempotent)', async () => {
    const id = `missing-${crypto.randomUUID()}`
    const res = await app.inject({
      method: 'DELETE',
      url: `/uploads/${id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    // Nothing was deleted, so nothing is audited
    expect(await findAuditLogs('delete', 'uploads', id)).toHaveLength(0)
  })
})

describe('Permission enforcement', () => {
  async function createRestrictedSession(
    grants: { resource: string; action: string }[]
  ) {
    const role = await createRoleWithPermissions(grants)
    const email = `restricted-uploads-${Date.now()}@test.com`
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: JSON.stringify({
        email,
        name: 'Restricted',
        password: 'Password123!',
      }),
      headers: { 'content-type': 'application/json' },
    })
    await testDb
      .update(user)
      .set({ roleId: role.id })
      .where(eq(user.email, email))
    const setCookie = res.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
    return cookies.map((c) => c.split(';')[0]).join('; ')
  }

  beforeEach(async () => {
    await cleanupUsers()
    await cleanupRoles()
  })

  it('returns 403 on GET /uploads without uploads:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/uploads',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on POST /uploads without uploads:create', async () => {
    const boundary = 'perm-boundary'
    const body = createMultipartBody(
      boundary,
      'test.pdf',
      'application/pdf',
      TINY_PDF
    )
    const cookie = await createRestrictedSession([
      { resource: 'uploads', action: 'view' },
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: {
        cookie,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on DELETE /uploads/:id without uploads:delete', async () => {
    const [inserted] = await testDb
      .insert(uploads)
      .values({
        originalName: 'perm.pdf',
        mimeType: 'application/pdf',
        fileSize: 10,
        storageKey: 'perm/original.pdf',
        url: 'http://localhost:3333/files/perm/original.pdf',
        variants: null,
      })
      .returning()
    const cookie = await createRestrictedSession([
      { resource: 'uploads', action: 'view' },
    ])
    const res = await app.inject({
      method: 'DELETE',
      url: `/uploads/${inserted.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
