import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { user } from '@/db/schema/authentication'
import { todoAttachments } from '@/db/schema/todo-attachments'
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
  grantActiveSubscription,
  testDb,
} from '@/test/helpers'

const app = createTestApp()
let authCookie = ''

beforeAll(async () => {
  await cleanupAuth()
  authCookie = await createTestSession(app)
})

async function insertUpload(name = 'file.pdf', mimeType = 'application/pdf') {
  const [upload] = await testDb
    .insert(uploads)
    .values({
      originalName: name,
      mimeType,
      fileSize: 100,
      storageKey: `test/${Date.now()}-${name}`,
      url: `http://localhost:3333/files/test/${name}`,
      variants: null,
    })
    .returning()
  return upload
}

beforeEach(async () => {
  await cleanupTodos()
  await cleanupUploads()
})

afterAll(async () => {
  await cleanupAuth()
  await app.close()
})

it('returns 401 on any route when not authenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/todos' })
  expect(res.statusCode).toBe(401)
})

describe('GET /todos', () => {
  it('returns empty array when no todos', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/todos',
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

  it('returns all todos', async () => {
    await testDb.insert(todos).values([
      {
        title: 'First',
        description: 'Desc 1',
        content: 'Content 1',
        date: new Date('2025-01-01'),
      },
      {
        title: 'Second',
        description: 'Desc 2',
        content: 'Content 2',
        date: new Date('2025-01-02'),
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/todos',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.data[0].title).toBe('First')
    expect(body.data[1].title).toBe('Second')
  })

  describe('Filtering', () => {
    beforeEach(async () => {
      await testDb.insert(todos).values([
        {
          title: 'Buy milk',
          description: 'Grocery errand',
          content: 'Content A',
          status: 'pending',
          date: new Date('2025-01-01'),
        },
        {
          title: 'Learn Rust',
          description: 'Programming task',
          content: 'Content B',
          status: 'pending',
          date: new Date('2025-03-01'),
        },
        {
          title: 'Read book',
          description: 'Leisure activity',
          content: 'Content C',
          status: 'completed',
          date: new Date('2025-06-01'),
        },
      ])
    })

    it('filters by status eq', async () => {
      const filters = JSON.stringify([
        { field: 'status', op: 'eq', value: 'completed' },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/todos?filters=${encodeURIComponent(filters)}`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].title).toBe('Read book')
    })

    it('filters by title contains (case-insensitive)', async () => {
      const filters = JSON.stringify([
        { field: 'title', op: 'contains', value: 'buy' },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/todos?filters=${encodeURIComponent(filters)}`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].title).toBe('Buy milk')
    })

    it('filters by date gte', async () => {
      const filters = JSON.stringify([
        { field: 'date', op: 'gte', value: '2025-03-01' },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/todos?filters=${encodeURIComponent(filters)}`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(2)
    })

    it('applies AND logic across two conditions', async () => {
      const filters = JSON.stringify([
        { field: 'status', op: 'eq', value: 'pending' },
        { field: 'title', op: 'contains', value: 'rust' },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/todos?filters=${encodeURIComponent(filters)}&filterLogic=AND`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].title).toBe('Learn Rust')
    })

    it('applies OR logic across two conditions', async () => {
      const filters = JSON.stringify([
        { field: 'status', op: 'eq', value: 'completed' },
        { field: 'title', op: 'contains', value: 'milk' },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/todos?filters=${encodeURIComponent(filters)}&filterLogic=OR`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(2)
    })

    it('returns all todos when filters is an empty array', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/todos?filters=${encodeURIComponent('[]')}`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().total).toBe(3)
    })

    it('returns all todos when filters is invalid JSON', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/todos?filters=not-valid-json`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().total).toBe(3)
    })
  })
})

describe('GET /todos/:id', () => {
  it('returns 404 when todo not found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/todos/nonexistent-id',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Todo not found' })
  })

  it('returns the todo when found', async () => {
    const [inserted] = await testDb
      .insert(todos)
      .values({
        title: 'My Todo',
        description: 'My Desc',
        content: 'My Content',
        date: new Date('2025-06-15'),
      })
      .returning()

    const res = await app.inject({
      method: 'GET',
      url: `/todos/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(inserted.id)
    expect(body.title).toBe('My Todo')
    expect(body.description).toBe('My Desc')
    expect(body.status).toBe('pending')
  })
})

describe('POST /todos', () => {
  it('creates a todo and returns 201', async () => {
    const attachment = await insertUpload()
    const file = await insertUpload('document.pdf')
    const image = await insertUpload('photo.jpg', 'image/jpeg')

    const res = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: {
        title: 'New Todo',
        description: 'New Desc',
        content: 'New Content',
        date: '2025-03-20',
        attachmentIds: [attachment.id],
        fileId: file.id,
        imageId: image.id,
      },
      headers: { cookie: authCookie },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBeDefined()
    expect(body.title).toBe('New Todo')
    expect(body.description).toBe('New Desc')
    expect(body.status).toBe('pending')
  })

  it('returns 400 when body is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: { title: '' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when fields exceed max length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: {
        title: 'a'.repeat(201),
        description: 'b'.repeat(501),
        content: 'c'.repeat(1001),
        date: '2025-03-20',
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /todos/:id', () => {
  it('returns 404 when todo not found', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/todos/nonexistent-id',
      payload: { title: 'Updated' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Todo not found' })
  })

  it('updates and returns the todo', async () => {
    const [inserted] = await testDb
      .insert(todos)
      .values({
        title: 'Old Title',
        description: 'Old Desc',
        content: 'Old Content',
        date: new Date('2025-01-01'),
      })
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/todos/${inserted.id}`,
      payload: { title: 'New Title', status: 'completed' },
      headers: { cookie: authCookie },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.title).toBe('New Title')
    expect(body.status).toBe('completed')
    expect(body.description).toBe('Old Desc')
  })
})

describe('DELETE /todos/:id', () => {
  it('returns 204 on successful delete', async () => {
    const [inserted] = await testDb
      .insert(todos)
      .values({
        title: 'To Delete',
        description: 'Desc',
        content: 'Content',
        date: new Date('2025-01-01'),
      })
      .returning()

    const res = await app.inject({
      method: 'DELETE',
      url: `/todos/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 204 even when todo does not exist', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/todos/nonexistent-id',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
  })
})

describe('Attachments', () => {
  it('creates a todo with attachmentIds and returns attachments in response', async () => {
    const attachment = await insertUpload()
    const file = await insertUpload('doc.pdf')
    const image = await insertUpload('img.jpg', 'image/jpeg')

    const res = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: {
        title: 'With attachment',
        description: 'Desc',
        content: 'Content',
        date: '2025-01-01',
        attachmentIds: [attachment.id],
        fileId: file.id,
        imageId: image.id,
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(201)
    const todo = res.json()
    expect(todo.attachments).toHaveLength(1)
    expect(todo.attachments[0].id).toBe(attachment.id)
  })

  it('returns attachments when fetching a todo by id', async () => {
    const attachment = await insertUpload()
    const file = await insertUpload('doc.pdf')
    const image = await insertUpload('img.jpg', 'image/jpeg')

    const createRes = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: {
        title: 'With attachment',
        description: 'Desc',
        content: 'Content',
        date: '2025-01-01',
        attachmentIds: [attachment.id],
        fileId: file.id,
        imageId: image.id,
      },
      headers: { cookie: authCookie },
    })
    const todoId = createRes.json().id

    const res = await app.inject({
      method: 'GET',
      url: `/todos/${todoId}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().attachments).toHaveLength(1)
    expect(res.json().attachments[0].id).toBe(attachment.id)
  })

  it('updates attachments when PATCH includes attachmentIds', async () => {
    const upload1 = await insertUpload()
    const file = await insertUpload('doc.pdf')
    const image = await insertUpload('img.jpg', 'image/jpeg')
    const [upload2] = await testDb
      .insert(uploads)
      .values({
        originalName: 'other.pdf',
        mimeType: 'application/pdf',
        fileSize: 200,
        storageKey: 'other/original.pdf',
        url: 'http://localhost:3333/files/other/original.pdf',
        variants: null,
      })
      .returning()

    const createRes = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: {
        title: 'Todo',
        description: 'Desc',
        content: 'Content',
        date: '2025-01-01',
        attachmentIds: [upload1.id],
        fileId: file.id,
        imageId: image.id,
      },
      headers: { cookie: authCookie },
    })
    const todoId = createRes.json().id

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/todos/${todoId}`,
      payload: { attachmentIds: [upload2.id] },
      headers: { cookie: authCookie },
    })
    expect(patchRes.statusCode).toBe(200)
    const updated = patchRes.json()
    expect(updated.attachments).toHaveLength(1)
    expect(updated.attachments[0].id).toBe(upload2.id)
  })

  it('deletes attachment records when todo is deleted', async () => {
    const upload = await insertUpload()
    const file = await insertUpload('doc.pdf')
    const image = await insertUpload('img.jpg', 'image/jpeg')
    const createRes = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: {
        title: 'To delete',
        description: 'Desc',
        content: 'Content',
        date: '2025-01-01',
        attachmentIds: [upload.id],
        fileId: file.id,
        imageId: image.id,
      },
      headers: { cookie: authCookie },
    })
    const todoId = createRes.json().id

    await app.inject({
      method: 'DELETE',
      url: `/todos/${todoId}`,
      headers: { cookie: authCookie },
    })

    const rows = await testDb
      .select()
      .from(todoAttachments)
      .where(eq(todoAttachments.todoId, todoId))
    expect(rows).toHaveLength(0)

    const [remainingUpload] = await testDb
      .select()
      .from(uploads)
      .where(eq(uploads.id, upload.id))
    expect(remainingUpload).toBeUndefined()
  })
})

describe('Permission enforcement', () => {
  async function createRestrictedSession(
    grants: { resource: string; action: string }[]
  ) {
    const role = await createRoleWithPermissions(grants)
    const email = `restricted-todos-${Date.now()}@test.com`
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
    // Past the subscription gate, so a 403 can only come from the permission
    await grantActiveSubscription(email)
    const setCookie = res.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
    return cookies.map((c) => c.split(';')[0]).join('; ')
  }

  beforeEach(async () => {
    await cleanupUsers()
    await cleanupRoles()
  })

  it('lets a restricted user with todos:view through (control)', async () => {
    const cookie = await createRestrictedSession([
      { resource: 'todos', action: 'view' },
    ])
    const res = await app.inject({
      method: 'GET',
      url: '/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 403 on GET /todos without todo:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on POST /todos without todo:create', async () => {
    const cookie = await createRestrictedSession([
      { resource: 'todos', action: 'view' },
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: {
        title: 'New',
        description: 'Desc',
        content: 'Content',
        date: '2025-01-01',
        attachmentIds: ['fake-att-id'],
        fileId: 'fake-file-id',
        imageId: 'fake-image-id',
      },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on PATCH /todos/:id without todo:edit', async () => {
    const [todo] = await testDb
      .insert(todos)
      .values({
        title: 'T',
        description: 'D',
        content: 'C',
        date: new Date('2025-01-01'),
      })
      .returning()
    const cookie = await createRestrictedSession([
      { resource: 'todos', action: 'view' },
    ])
    const res = await app.inject({
      method: 'PATCH',
      url: `/todos/${todo.id}`,
      payload: { title: 'Updated' },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 on DELETE /todos/:id without todo:delete', async () => {
    const [todo] = await testDb
      .insert(todos)
      .values({
        title: 'T',
        description: 'D',
        content: 'C',
        date: new Date('2025-01-01'),
      })
      .returning()
    const cookie = await createRestrictedSession([
      { resource: 'todos', action: 'view' },
    ])
    const res = await app.inject({
      method: 'DELETE',
      url: `/todos/${todo.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
