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

import { config } from '@/config'
import { user } from '@/db/schema/authentication'
import { todoAttachments } from '@/db/schema/todo-attachments'
import { todoContentImages } from '@/db/schema/todo-content-images'
import { todos } from '@/db/schema/todos'
import { uploads } from '@/db/schema/uploads'
import {
  cleanupAuth,
  cleanupRoles,
  cleanupTodos,
  cleanupUploads,
  cleanupUsers,
  createRoleWithPermissions,
  createTestApp,
  createTestSession,
  getTestUser,
  grantActiveSubscription,
  testDb,
  todoRow,
} from '@/test/helpers'

const app = createTestApp()
const uploadDir = path.resolve(config.uploads.dir)
const folders: string[] = []
let adminCookie = ''

beforeAll(async () => {
  await cleanupAuth()
  adminCookie = await createTestSession(app)
})

beforeEach(async () => {
  await cleanupTodos()
  await cleanupUploads()
  await cleanupUsers()
  await cleanupRoles()
})

afterEach(async () => {
  await Promise.all(
    folders
      .splice(0)
      .map((folder) =>
        fs.rm(path.join(uploadDir, folder), { recursive: true, force: true })
      )
  )
})

afterAll(async () => {
  await cleanupTodos()
  await cleanupUploads()
  await cleanupAuth()
  await app.close()
})

// --- helpers ---

/** Writes a file under a fresh folder of the upload dir; returns its key. */
async function writeStoredFile(name: string, content = 'hello') {
  const folder = crypto.randomUUID()
  folders.push(folder)
  await fs.mkdir(path.join(uploadDir, folder), { recursive: true })
  await fs.writeFile(path.join(uploadDir, folder, name), content)
  return `${folder}/${name}`
}

/** A stored file and the `uploads` row that owns it. */
async function insertUpload(
  name = 'original.txt',
  values: Partial<typeof uploads.$inferInsert> = {}
) {
  const storageKey = await writeStoredFile(name)
  const [upload] = await testDb
    .insert(uploads)
    .values({
      originalName: name,
      mimeType: 'text/plain',
      fileSize: 5,
      storageKey,
      url: `http://localhost:3333/api/files/${storageKey}`,
      variants: null,
      ...values,
    })
    .returning()
  return upload
}

/** A signed-up user whose role holds exactly `grants`. */
async function createUserSession(
  grants: { resource: string; action: string }[],
  options: { subscribed?: boolean } = {}
) {
  const role = await createRoleWithPermissions(grants)
  const email = `files-${crypto.randomUUID()}@test.com`
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: JSON.stringify({
      email,
      name: 'Reader',
      password: 'Password123!',
    }),
    headers: { 'content-type': 'application/json' },
  })
  const [created] = await testDb
    .update(user)
    .set({ roleId: role.id })
    .where(eq(user.email, email))
    .returning()
  if (options.subscribed) await grantActiveSubscription(email)
  const setCookie = res.headers['set-cookie']
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
  return {
    id: created.id,
    cookie: cookies.map((c) => c.split(';')[0]).join('; '),
  }
}

type TodoReference = 'attachment' | 'file' | 'image' | 'content'

/** A todo referencing the upload through one of its columns or tables. */
async function attachToTodo(reference: TodoReference, uploadId: string) {
  const [todo] = await testDb
    .insert(todos)
    .values(
      todoRow({
        title: 'With a file',
        description: 'Desc',
        content: 'Content',
        date: new Date('2025-01-01'),
        fileId: reference === 'file' ? uploadId : null,
        imageId: reference === 'image' ? uploadId : null,
      })
    )
    .returning()
  if (reference === 'attachment') {
    await testDb.insert(todoAttachments).values({ todoId: todo.id, uploadId })
  }
  if (reference === 'content') {
    await testDb.insert(todoContentImages).values({ todoId: todo.id, uploadId })
  }
}

function getFile(key: string, cookie?: string) {
  return app.inject({
    method: 'GET',
    url: `/api/files/${key}`,
    headers: cookie ? { cookie } : {},
  })
}

// ---

it('returns 401 when not authenticated', async () => {
  const upload = await insertUpload()
  const res = await getFile(upload.storageKey)
  expect(res.statusCode).toBe(401)
})

describe('GET /files/*', () => {
  it("serves an upload's original", async () => {
    const upload = await insertUpload()
    const res = await getFile(upload.storageKey, adminCookie)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('hello')
  })

  it("serves an upload's image variants", async () => {
    const upload = await insertUpload('original.png', {
      mimeType: 'image/png',
    })
    const folder = upload.storageKey.split('/')[0]
    const thumbnailKey = `${folder}/thumbnail.webp`
    await fs.writeFile(path.join(uploadDir, thumbnailKey), 'thumb')
    const variant = { key: thumbnailKey, url: `http://x/${thumbnailKey}` }
    await testDb
      .update(uploads)
      .set({
        variants: {
          thumbnail: variant,
          small: variant,
          medium: variant,
          large: variant,
        },
      })
      .where(eq(uploads.id, upload.id))

    const res = await getFile(thumbnailKey, adminCookie)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('thumb')
  })

  it('returns 404 for a stored file no upload owns', async () => {
    const key = await writeStoredFile('original.txt')
    const res = await getFile(key, adminCookie)
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for an unknown key', async () => {
    const res = await getFile(
      `${crypto.randomUUID()}/original.txt`,
      adminCookie
    )
    expect(res.statusCode).toBe(404)
  })
})

describe('Who may read a file', () => {
  it('serves an upload to the user who uploaded it', async () => {
    const uploader = await createUserSession([])
    const upload = await insertUpload('original.txt', {
      uploadedBy: uploader.id,
    })
    const res = await getFile(upload.storageKey, uploader.cookie)
    expect(res.statusCode).toBe(200)
  })

  it('serves any upload to a user with uploads:view', async () => {
    const admin = await getTestUser()
    const upload = await insertUpload('original.txt', { uploadedBy: admin.id })
    const viewer = await createUserSession([
      { resource: 'uploads', action: 'view' },
    ])
    const res = await getFile(upload.storageKey, viewer.cookie)
    expect(res.statusCode).toBe(200)
  })

  it("returns 404 for someone else's upload without uploads:view", async () => {
    const admin = await getTestUser()
    const upload = await insertUpload('original.txt', { uploadedBy: admin.id })
    const other = await createUserSession([], { subscribed: true })
    const res = await getFile(upload.storageKey, other.cookie)
    expect(res.statusCode).toBe(404)
  })

  describe.each<TodoReference>(['attachment', 'file', 'image', 'content'])(
    'a todo %s',
    (reference) => {
      it('is served to a user who may read todos', async () => {
        const upload = await insertUpload()
        await attachToTodo(reference, upload.id)
        const reader = await createUserSession(
          [{ resource: 'todos', action: 'view' }],
          { subscribed: true }
        )
        const res = await getFile(upload.storageKey, reader.cookie)
        expect(res.statusCode).toBe(200)
      })

      it('returns 404 without todos:view', async () => {
        const upload = await insertUpload()
        await attachToTodo(reference, upload.id)
        const other = await createUserSession([], { subscribed: true })
        const res = await getFile(upload.storageKey, other.cookie)
        expect(res.statusCode).toBe(404)
      })

      it('returns 404 without a subscription to todos', async () => {
        const upload = await insertUpload()
        await attachToTodo(reference, upload.id)
        const lapsed = await createUserSession([
          { resource: 'todos', action: 'view' },
        ])
        const res = await getFile(upload.storageKey, lapsed.cookie)
        expect(res.statusCode).toBe(404)
      })
    }
  )

  describe('with subscriptions disabled', () => {
    const unpaidApp = createTestApp({ subscriptions: { enabled: false } })

    afterAll(async () => {
      await unpaidApp.close()
    })

    it('serves a todo attachment on todos:view alone', async () => {
      const upload = await insertUpload()
      await attachToTodo('attachment', upload.id)
      const reader = await createUserSession([
        { resource: 'todos', action: 'view' },
      ])
      const res = await unpaidApp.inject({
        method: 'GET',
        url: `/api/files/${upload.storageKey}`,
        headers: { cookie: reader.cookie },
      })
      expect(res.statusCode).toBe(200)
    })
  })
})

describe('Response headers', () => {
  it('marks every file nosniff and private', async () => {
    const upload = await insertUpload()
    const res = await getFile(upload.storageKey, adminCookie)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['cache-control']).toBe('private, max-age=0')
  })

  // The extension picks the Content-Type, and the uploader picks the
  // extension: an active document must never render on the API's origin.
  it.each(['html', 'htm', 'svg', 'xml', 'xhtml', 'js', 'docx'])(
    'sends a .%s file as a sandboxed download',
    async (extension) => {
      const upload = await insertUpload(`original.${extension}`)
      const res = await getFile(upload.storageKey, adminCookie)
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-disposition']).toBe('attachment')
      expect(res.headers['content-security-policy']).toBe(
        "default-src 'none'; sandbox"
      )
      expect(res.headers['x-content-type-options']).toBe('nosniff')
    }
  )

  it('keeps the Content-Type of the extension', async () => {
    const upload = await insertUpload('original.html')
    const res = await getFile(upload.storageKey, adminCookie)
    expect(res.headers['content-type']).toContain('text/html')
  })

  // Every extension a passive allowed type maps to (images, PDF, plain text,
  // audio, video) still opens in the browser.
  it.each([
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'avif',
    'pdf',
    'txt',
    'text',
    'log',
    'ini',
    'conf',
    'def',
    'list',
    'in',
    'mp3',
    'mpga',
    'mp2',
    'mp2a',
    'm2a',
    'm3a',
    'wav',
    'ogg',
    'oga',
    'spx',
    'opus',
    'aac',
    'flac',
    'm4a',
    'mp4',
    'mp4v',
    'mpg4',
    'mov',
    'qt',
    'webm',
    'ogv',
  ])('opens a .%s file inline', async (extension) => {
    const upload = await insertUpload(`original.${extension}`)
    const res = await getFile(upload.storageKey, adminCookie)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-disposition']).toBeUndefined()
    expect(res.headers['content-security-policy']).toBeUndefined()
  })
})
