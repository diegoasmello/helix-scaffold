import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { user } from '@/db/schema/authentication'
import { todoAttachments } from '@/db/schema/todo-attachments'
import { todoContentImages } from '@/db/schema/todo-content-images'
import { todos } from '@/db/schema/todos'
import { uploads } from '@/db/schema/uploads'
import { deleteOrphanUploads } from '@/lib/orphan-uploads'
import type { StorageProvider } from '@/lib/storage'
import { getUploadReferenceLoaders } from '@/lib/upload-references'
import {
  cleanupAuth,
  cleanupRoles,
  cleanupTodos,
  cleanupUploads,
  cleanupUsers,
  createRoleWithPermissions,
  createTestApp,
  createTestSession,
  findAuditLogs,
  getTestUser,
  grantActiveSubscription,
  testDb,
  todoRow,
} from '@/test/helpers'

const app = createTestApp()
let authCookie = ''
/** The signed-in test user: a todo may only reference uploads it uploaded. */
let testUserId = ''

beforeAll(async () => {
  await cleanupAuth()
  authCookie = await createTestSession(app)
  testUserId = (await getTestUser()).id
})

async function insertUpload(
  name = 'file.pdf',
  mimeType = 'application/pdf',
  uploadedBy: string | null = testUserId
) {
  const [upload] = await testDb
    .insert(uploads)
    .values({
      uploadedBy,
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
  const res = await app.inject({ method: 'GET', url: '/api/todos' })
  expect(res.statusCode).toBe(401)
})

describe('GET /todos', () => {
  it('returns empty array when no todos', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/todos',
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
      todoRow({
        title: 'First',
        description: 'Desc 1',
        content: 'Content 1',
        date: new Date('2025-01-01'),
      }),
      todoRow({
        title: 'Second',
        description: 'Desc 2',
        content: 'Content 2',
        date: new Date('2025-01-02'),
      }),
    ])

    const res = await app.inject({
      method: 'GET',
      url: '/api/todos',
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
        todoRow({
          title: 'Buy milk',
          description: 'Grocery errand',
          content: 'Content A',
          status: 'pending',
          date: new Date('2025-01-01'),
        }),
        todoRow({
          title: 'Learn Rust',
          description: 'Programming task',
          content: 'Content B',
          status: 'pending',
          date: new Date('2025-03-01'),
        }),
        todoRow({
          title: 'Read book',
          description: 'Leisure activity',
          content: 'Content C',
          status: 'completed',
          date: new Date('2025-06-01'),
        }),
      ])
    })

    it('filters by status eq', async () => {
      const filters = JSON.stringify([
        { field: 'status', op: 'eq', value: 'completed' },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/api/todos?filters=${encodeURIComponent(filters)}`,
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
        url: `/api/todos?filters=${encodeURIComponent(filters)}`,
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
        url: `/api/todos?filters=${encodeURIComponent(filters)}`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(2)
    })

    it('filters by date between, both ends included', async () => {
      const filters = JSON.stringify([
        { field: 'date', op: 'between', value: ['2025-03-01', '2025-06-01'] },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/api/todos?filters=${encodeURIComponent(filters)}&sortBy=date&sortOrder=asc`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(2)
      expect(body.data.map((t: { title: string }) => t.title)).toEqual([
        'Learn Rust',
        'Read book',
      ])
    })

    it('filters by status in', async () => {
      const filters = JSON.stringify([
        { field: 'status', op: 'in', value: ['pending'] },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/api/todos?filters=${encodeURIComponent(filters)}`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().total).toBe(2)
    })

    it('searches the title and the description', async () => {
      const get = (search: string) =>
        app.inject({
          method: 'GET',
          url: `/api/todos?search=${encodeURIComponent(search)}`,
          headers: { cookie: authCookie },
        })
      const byTitle = (await get('RUST')).json()
      expect(byTitle.data.map((t: { title: string }) => t.title)).toEqual([
        'Learn Rust',
      ])
      expect((await get('errand')).json().data[0].title).toBe('Buy milk')
      expect((await get('%')).json().total).toBe(0)
    })

    it('combines the search with the filters', async () => {
      const filters = JSON.stringify([
        { field: 'status', op: 'eq', value: 'completed' },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/api/todos?search=milk&filters=${encodeURIComponent(filters)}`,
        headers: { cookie: authCookie },
      })
      expect(res.json().total).toBe(0)
    })

    it('applies AND logic across two conditions', async () => {
      const filters = JSON.stringify([
        { field: 'status', op: 'eq', value: 'pending' },
        { field: 'title', op: 'contains', value: 'rust' },
      ])
      const res = await app.inject({
        method: 'GET',
        url: `/api/todos?filters=${encodeURIComponent(filters)}&filterLogic=AND`,
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
        url: `/api/todos?filters=${encodeURIComponent(filters)}&filterLogic=OR`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(2)
    })

    it('returns all todos when filters is an empty array', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/todos?filters=${encodeURIComponent('[]')}`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().total).toBe(3)
    })

    it('returns all todos when filters is invalid JSON', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/todos?filters=not-valid-json`,
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().total).toBe(3)
    })
  })
})

describe('Normalized text columns', () => {
  const titles = (body: { data: { title: string }[] }) =>
    body.data.map((t) => t.title)

  async function list(query: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/todos?${query}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    return res.json()
  }

  const containsFilter = (field: string, op: string, value: string) =>
    `filters=${encodeURIComponent(JSON.stringify([{ field, op, value }]))}`

  beforeEach(async () => {
    await testDb.insert(todos).values([
      todoRow({
        title: 'Ação  RÁPIDA',
        description: 'Reunião em São Paulo',
        content: 'Content A',
        date: new Date('2025-01-01'),
      }),
      todoRow({
        title: 'abacate',
        description: 'Feira',
        content: 'Content B',
        date: new Date('2025-01-02'),
      }),
      todoRow({
        title: 'Zebra',
        description: 'Zoo',
        content: 'Content C',
        date: new Date('2025-01-03'),
      }),
    ])
  })

  it('searches ignoring accents, case and repeated whitespace', async () => {
    expect(titles(await list('search=acao%20rapida'))).toEqual(['Ação  RÁPIDA'])
    expect(titles(await list('search=AÇÃO'))).toEqual(['Ação  RÁPIDA'])
    expect(
      titles(await list(`search=${encodeURIComponent('sao   paulo')}`))
    ).toEqual(['Ação  RÁPIDA'])
  })

  it('applies contains, startsWith and endsWith on the normalized copy', async () => {
    expect(
      titles(await list(containsFilter('title', 'contains', 'acao')))
    ).toEqual(['Ação  RÁPIDA'])
    expect(
      titles(await list(containsFilter('title', 'startsWith', 'ACAO R')))
    ).toEqual(['Ação  RÁPIDA'])
    expect(
      titles(await list(containsFilter('description', 'endsWith', 'PAULO')))
    ).toEqual(['Ação  RÁPIDA'])
  })

  it('keeps eq exact', async () => {
    expect(
      (await list(containsFilter('title', 'eq', 'acao rapida'))).total
    ).toBe(0)
    expect(
      titles(await list(containsFilter('title', 'eq', 'Ação  RÁPIDA')))
    ).toEqual(['Ação  RÁPIDA'])
  })

  it('sorts the title by its normalized copy', async () => {
    expect(titles(await list('sortBy=title&sortOrder=asc'))).toEqual([
      'abacate',
      'Ação  RÁPIDA',
      'Zebra',
    ])
  })

  it('never returns the normalized columns', async () => {
    const [item] = (await list('')).data
    expect(item).not.toHaveProperty('normalizedTitle')
    expect(item).not.toHaveProperty('normalizedDescription')
  })

  it('fills them on create and refreshes them on update', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: {
        title: 'Café com pão',
        description: 'Padaria',
        content: '<p>C</p>',
        date: '2025-03-20',
        attachmentIds: [(await insertUpload()).id],
        fileId: (await insertUpload()).id,
        imageId: (await insertUpload('img.png', 'image/png')).id,
      },
      headers: { cookie: authCookie },
    })
    expect(create.statusCode).toBe(201)
    const { id } = create.json()
    expect(titles(await list('search=cafe%20com%20pao'))).toEqual([
      'Café com pão',
    ])

    await app.inject({
      method: 'PATCH',
      url: `/api/todos/${id}`,
      payload: { title: 'Pão de queijo' },
      headers: { cookie: authCookie },
    })
    expect((await list('search=cafe')).total).toBe(0)
    expect(titles(await list('search=pao%20de%20queijo'))).toEqual([
      'Pão de queijo',
    ])
    // `description` was not sent: its normalized copy is untouched.
    expect(titles(await list('search=padaria'))).toEqual(['Pão de queijo'])
  })
})

describe('Slug', () => {
  async function createTodo(payload: Record<string, unknown>) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: {
        description: 'Desc',
        content: '<p>C</p>',
        date: '2025-03-20',
        attachmentIds: [(await insertUpload()).id],
        fileId: (await insertUpload()).id,
        imageId: (await insertUpload('img.png', 'image/png')).id,
        ...payload,
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(201)
    return res.json()
  }

  it('generates it from the title on create', async () => {
    expect((await createTodo({ title: 'Comprar pão na padaria' })).slug).toBe(
      'comprar-pao-na-padaria'
    )
  })

  it('suffixes a slug already taken', async () => {
    expect((await createTodo({ title: 'Ação' })).slug).toBe('acao')
    expect((await createTodo({ title: 'ação' })).slug).toBe('acao-2')
    expect((await createTodo({ title: 'AÇÃO!' })).slug).toBe('acao-3')
  })

  it('cuts the base to fit the suffix in 100 characters', async () => {
    const title = 'a'.repeat(100)
    expect((await createTodo({ title })).slug).toBe(title)
    const second = (await createTodo({ title })).slug
    expect(second).toBe(`${'a'.repeat(98)}-2`)
    expect(second).toHaveLength(100)
    expect((await createTodo({ title })).slug).toBe(`${'a'.repeat(98)}-3`)
  })

  it('falls back to the entity name when the title has no slug character', async () => {
    expect((await createTodo({ title: '日本語' })).slug).toBe('todo')
    expect((await createTodo({ title: '!!!' })).slug).toBe('todo-2')
  })

  it('gives concurrent creates with the same title distinct slugs', async () => {
    const created = await Promise.all(
      Array.from({ length: 4 }, () => createTodo({ title: 'Mesmo título' }))
    )
    expect(new Set(created.map((todo) => todo.slug)).size).toBe(4)
  })

  it('ignores a slug sent in the body', async () => {
    const todo = await createTodo({ title: 'Título', slug: 'escolhido' })
    expect(todo.slug).toBe('titulo')

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${todo.id}`,
      payload: { slug: 'outro' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().slug).toBe('titulo')
  })

  it('keeps the slug when the title changes', async () => {
    const todo = await createTodo({ title: 'Título original' })
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${todo.id}`,
      payload: { title: 'Título novo' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Título novo')
    expect(res.json().slug).toBe('titulo-original')
  })

  it('is unique in the table', async () => {
    await testDb.insert(todos).values(
      todoRow({
        title: 'A',
        description: 'D',
        content: 'C',
        date: new Date('2025-01-01'),
        slug: 'repetido',
      })
    )
    await expect(
      testDb.insert(todos).values(
        todoRow({
          title: 'B',
          description: 'D',
          content: 'C',
          date: new Date('2025-01-01'),
          slug: 'repetido',
        })
      )
    ).rejects.toThrow()
  })

  describe('GET /todos/by-slug/:slug', () => {
    it('returns the todo with that slug', async () => {
      const todo = await createTodo({ title: 'Página pública' })
      const res = await app.inject({
        method: 'GET',
        url: '/api/todos/by-slug/pagina-publica',
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().id).toBe(todo.id)
      expect(res.json().attachments).toHaveLength(1)
    })

    it('returns 404 for an unknown slug', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/todos/by-slug/nao-existe',
        headers: { cookie: authCookie },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ message: 'Todo not found' })
    })
  })
})

describe('GET /todos/:id', () => {
  it('returns 404 when todo not found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/todos/nonexistent-id',
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Todo not found' })
  })

  it('returns the todo when found', async () => {
    const [inserted] = await testDb
      .insert(todos)
      .values(
        todoRow({
          title: 'My Todo',
          description: 'My Desc',
          content: 'My Content',
          date: new Date('2025-06-15'),
        })
      )
      .returning()

    const res = await app.inject({
      method: 'GET',
      url: `/api/todos/${inserted.id}`,
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
      url: '/api/todos',
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
    expect(await findAuditLogs('create', 'todos', body.id)).toHaveLength(1)
    expect(body.description).toBe('New Desc')
    expect(body.status).toBe('pending')
  })

  it('returns 400 when body is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { title: '' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when fields exceed max length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
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
      url: '/api/todos/nonexistent-id',
      payload: { title: 'Updated' },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ message: 'Todo not found' })
  })

  it('updates and returns the todo', async () => {
    const [inserted] = await testDb
      .insert(todos)
      .values(
        todoRow({
          title: 'Old Title',
          description: 'Old Desc',
          content: 'Old Content',
          date: new Date('2025-01-01'),
        })
      )
      .returning()

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${inserted.id}`,
      payload: { title: 'New Title', status: 'completed' },
      headers: { cookie: authCookie },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.title).toBe('New Title')
    expect(body.status).toBe('completed')
    expect(body.description).toBe('Old Desc')
    expect(await findAuditLogs('edit', 'todos', inserted.id)).toHaveLength(1)
  })
})

describe('DELETE /todos/:id', () => {
  it('returns 204 on successful delete', async () => {
    const [inserted] = await testDb
      .insert(todos)
      .values(
        todoRow({
          title: 'To Delete',
          description: 'Desc',
          content: 'Content',
          date: new Date('2025-01-01'),
        })
      )
      .returning()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/todos/${inserted.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await findAuditLogs('delete', 'todos', inserted.id)).toHaveLength(1)
  })

  it('returns 204 even when todo does not exist', async () => {
    const id = `missing-${crypto.randomUUID()}`
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/todos/${id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    // Nothing was deleted, so nothing is audited
    expect(await findAuditLogs('delete', 'todos', id)).toHaveLength(0)
  })
})

describe('Attachments', () => {
  it('creates a todo with attachmentIds and returns attachments in response', async () => {
    const attachment = await insertUpload()
    const file = await insertUpload('doc.pdf')
    const image = await insertUpload('img.jpg', 'image/jpeg')

    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
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
      url: '/api/todos',
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
      url: `/api/todos/${todoId}`,
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
        uploadedBy: testUserId,
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
      url: '/api/todos',
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
      url: `/api/todos/${todoId}`,
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
      url: '/api/todos',
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
      url: `/api/todos/${todoId}`,
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

describe('Images in the content', () => {
  /** The `<img>` the editor inserts for an upload (`onUploadImage`). */
  const img = (upload: { storageKey: string }) =>
    `<img src="http://localhost:3333/api/files/${upload.storageKey}">`

  async function contentImageIds(todoId: string) {
    const rows = await testDb
      .select({ id: todoContentImages.uploadId })
      .from(todoContentImages)
      .where(eq(todoContentImages.todoId, todoId))
    return rows.map((r) => r.id).sort()
  }

  async function uploadExists(id: string) {
    const rows = await testDb.select().from(uploads).where(eq(uploads.id, id))
    return rows.length > 0
  }

  async function createTodo(
    content: string,
    overrides: Record<string, unknown> = {}
  ) {
    const [attachment, file, image] = await Promise.all([
      insertUpload(),
      insertUpload('doc.pdf'),
      insertUpload('img.jpg', 'image/jpeg'),
    ])
    return app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: {
        title: 'Todo',
        description: 'Desc',
        content,
        date: '2025-01-01',
        attachmentIds: [attachment.id],
        fileId: file.id,
        imageId: image.id,
        ...overrides,
      },
      headers: { cookie: authCookie },
    })
  }

  function patchTodo(id: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'PATCH',
      url: `/api/todos/${id}`,
      payload,
      headers: { cookie: authCookie },
    })
  }

  /** Runs the orphan cleanup on every upload, whatever its age. */
  async function runOrphanCleanup() {
    const storage: StorageProvider = {
      save: async () => {},
      delete: async () => {},
      getUrl: (key) => key,
    }
    await deleteOrphanUploads(testDb, storage, getUploadReferenceLoaders(), {
      graceHours: 0,
    })
  }

  it('records the uploads the content shows', async () => {
    const [a, b] = await Promise.all([
      insertUpload('a.png', 'image/png'),
      insertUpload('b.png', 'image/png'),
    ])
    const res = await createTodo(`<p>Text</p>${img(a)}<p>More</p>${img(b)}`)
    expect(res.statusCode).toBe(201)
    expect(await contentImageIds(res.json().id)).toEqual([a.id, b.id].sort())
  })

  it('ignores images from elsewhere and keys no upload owns', async () => {
    const res = await createTodo(
      '<img src="https://cdn.example.com/x.png">' +
        img({ storageKey: `${crypto.randomUUID()}/original.png` })
    )
    expect(res.statusCode).toBe(201)
    expect(await contentImageIds(res.json().id)).toEqual([])
  })

  it('keeps them from the orphan cleanup', async () => {
    const image = await insertUpload('a.png', 'image/png')
    await createTodo(img(image))
    await runOrphanCleanup()
    expect(await uploadExists(image.id)).toBe(true)
  })

  it("refuses someone else's upload on create, and creates nothing", async () => {
    const theirs = await insertUpload('theirs.png', 'image/png', null)
    const res = await createTodo(img(theirs))
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_upload')
    expect(await testDb.select().from(todos)).toHaveLength(0)
  })

  it("refuses someone else's upload added on update", async () => {
    const mine = await insertUpload('mine.png', 'image/png')
    const created = (await createTodo(img(mine))).json()
    const theirs = await insertUpload('theirs.png', 'image/png', null)
    const res = await patchTodo(created.id, {
      content: img(mine) + img(theirs),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_upload')
    expect(await contentImageIds(created.id)).toEqual([mine.id])
  })

  it('lets another editor re-send the images the content already shows', async () => {
    // A todo someone else wrote: its image is not the test user's.
    const theirs = await insertUpload('theirs.png', 'image/png', null)
    const [todo] = await testDb
      .insert(todos)
      .values(
        todoRow({
          title: 'Theirs',
          description: 'Desc',
          content: img(theirs),
          date: new Date('2025-01-01'),
        })
      )
      .returning()
    await testDb
      .insert(todoContentImages)
      .values({ todoId: todo.id, uploadId: theirs.id })

    const res = await patchTodo(todo.id, {
      content: `<p>Edited</p>${img(theirs)}`,
    })
    expect(res.statusCode).toBe(200)
    expect(await contentImageIds(todo.id)).toEqual([theirs.id])
  })

  it('leaves them alone when PATCH does not send the content', async () => {
    const image = await insertUpload('a.png', 'image/png')
    const created = (await createTodo(img(image))).json()
    const res = await patchTodo(created.id, { title: 'Renamed' })
    expect(res.statusCode).toBe(200)
    expect(await contentImageIds(created.id)).toEqual([image.id])
  })

  it('lets the orphan cleanup delete an image taken out of the text', async () => {
    const [kept, removed] = await Promise.all([
      insertUpload('kept.png', 'image/png'),
      insertUpload('removed.png', 'image/png'),
    ])
    const created = (await createTodo(img(kept) + img(removed))).json()

    const res = await patchTodo(created.id, { content: img(kept) })
    expect(res.statusCode).toBe(200)
    expect(await contentImageIds(created.id)).toEqual([kept.id])

    await runOrphanCleanup()
    expect(await uploadExists(kept.id)).toBe(true)
    expect(await uploadExists(removed.id)).toBe(false)
  })

  it('deletes them with the todo', async () => {
    const image = await insertUpload('a.png', 'image/png')
    const created = (await createTodo(img(image))).json()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/todos/${created.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await uploadExists(image.id)).toBe(false)
  })

  it('deletes an upload once when it is both the image and in the content', async () => {
    const image = await insertUpload('a.png', 'image/png')
    const created = (await createTodo(img(image), { imageId: image.id })).json()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/todos/${created.id}`,
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await uploadExists(image.id)).toBe(false)
  })
})

describe('Upload ownership', () => {
  // `uploadedBy: null` stands for someone else's upload (its uploader is not
  // the signed-in test user).
  const foreignUpload = () =>
    insertUpload('theirs.pdf', 'application/pdf', null)

  async function createTodo(overrides: Record<string, unknown> = {}) {
    const [attachment, file, image] = await Promise.all([
      insertUpload(),
      insertUpload('doc.pdf'),
      insertUpload('img.jpg', 'image/jpeg'),
    ])
    return app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: {
        title: 'Todo',
        description: 'Desc',
        content: 'Content',
        date: '2025-01-01',
        attachmentIds: [attachment.id],
        fileId: file.id,
        imageId: image.id,
        ...overrides,
      },
      headers: { cookie: authCookie },
    })
  }

  it.each(['attachmentIds', 'fileId', 'imageId'])(
    "refuses someone else's upload in %s on create, and creates nothing",
    async (field) => {
      const theirs = await foreignUpload()
      const res = await createTodo({
        [field]: field === 'attachmentIds' ? [theirs.id] : theirs.id,
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe('invalid_upload')
      expect(await testDb.select().from(todos)).toHaveLength(0)
    }
  )

  it('answers an unknown upload id the same way', async () => {
    const res = await createTodo({ fileId: crypto.randomUUID() })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_upload')
  })

  it("refuses to add someone else's upload on update, and leaves the attachments as they were", async () => {
    const created = (await createTodo()).json()
    const theirs = await foreignUpload()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${created.id}`,
      payload: { attachmentIds: [created.attachments[0].id, theirs.id] },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_upload')
    const rows = await testDb
      .select()
      .from(todoAttachments)
      .where(eq(todoAttachments.todoId, created.id))
    expect(rows.map((r) => r.uploadId)).toEqual([created.attachments[0].id])
  })

  it('lets another editor re-send the files the todo already has', async () => {
    // A todo someone else filled: none of its uploads are the test user's.
    const [attachment, file, image] = await Promise.all([
      foreignUpload(),
      foreignUpload(),
      insertUpload('theirs.jpg', 'image/jpeg', null),
    ])
    const [todo] = await testDb
      .insert(todos)
      .values(
        todoRow({
          title: 'Theirs',
          description: 'Desc',
          content: 'Content',
          date: new Date('2025-01-01'),
          fileId: file.id,
          imageId: image.id,
        })
      )
      .returning()
    await testDb
      .insert(todoAttachments)
      .values({ todoId: todo.id, uploadId: attachment.id })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${todo.id}`,
      payload: {
        title: 'Edited',
        attachmentIds: [attachment.id],
        fileId: file.id,
        imageId: image.id,
      },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Edited')
  })

  it('answers 404 for an unknown todo before looking at its uploads', async () => {
    const theirs = await foreignUpload()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${crypto.randomUUID()}`,
      payload: { fileId: theirs.id },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('Upload types', () => {
  async function createTodo(overrides: Record<string, unknown> = {}) {
    const [attachment, file, image] = await Promise.all([
      insertUpload(),
      insertUpload('doc.pdf'),
      insertUpload('img.jpg', 'image/jpeg'),
    ])
    return app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: {
        title: 'Todo',
        description: 'Desc',
        content: 'Content',
        date: '2025-01-01',
        attachmentIds: [attachment.id],
        fileId: file.id,
        imageId: image.id,
        ...overrides,
      },
      headers: { cookie: authCookie },
    })
  }

  const img = (upload: { storageKey: string }) =>
    `<img src="http://localhost:3333/api/files/${upload.storageKey}">`

  it.each([
    ['imageId', 'doc.pdf', 'application/pdf'],
    ['fileId', 'img.png', 'image/png'],
  ])(
    'refuses a %s of the wrong type (%s) on create, and creates nothing',
    async (field, name, mimeType) => {
      const wrong = await insertUpload(name, mimeType)
      const res = await createTodo({ [field]: wrong.id })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe('invalid_upload_type')
      expect(await testDb.select().from(todos)).toHaveLength(0)
    }
  )

  it('refuses a file that is not an image inside the content', async () => {
    const pdf = await insertUpload('doc.pdf')
    const res = await createTodo({ content: img(pdf) })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_upload_type')
  })

  it('accepts any image type in the image', async () => {
    const svg = await insertUpload('logo.svg', 'image/svg+xml')
    const res = await createTodo({ imageId: svg.id })
    expect(res.statusCode).toBe(201)
  })

  it('accepts any file type in the attachments', async () => {
    const audio = await insertUpload('song.mp3', 'audio/mpeg')
    const res = await createTodo({ attachmentIds: [audio.id] })
    expect(res.statusCode).toBe(201)
  })

  it('refuses an image of the wrong type on update, and keeps the old one', async () => {
    const created = (await createTodo()).json()
    const pdf = await insertUpload('other.pdf')
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${created.id}`,
      payload: { imageId: pdf.id },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_upload_type')
    const [row] = await testDb
      .select({ imageId: todos.imageId })
      .from(todos)
      .where(eq(todos.id, created.id))
    expect(row.imageId).toBe(created.image.id)
  })

  it('checks the type of a file the todo already has when it moves to another field', async () => {
    // The todo's PDF re-sent as its image: kept, so its owner is not checked
    // again — but the image field still takes only images.
    const created = (await createTodo()).json()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${created.id}`,
      payload: { imageId: created.file.id },
      headers: { cookie: authCookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_upload_type')
  })

  it("answers invalid_upload, not the type, for someone else's file", async () => {
    const theirs = await insertUpload('theirs.pdf', 'application/pdf', null)
    const res = await createTodo({ imageId: theirs.id })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_upload')
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
      url: '/api/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 403 on GET /todos without todo:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/todos',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('permission_denied')
  })

  it('returns 403 on GET /todos/by-slug/:slug without todo:view', async () => {
    const cookie = await createRestrictedSession([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/todos/by-slug/any',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('permission_denied')
  })

  it('returns 403 on POST /todos without todo:create', async () => {
    const cookie = await createRestrictedSession([
      { resource: 'todos', action: 'view' },
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/api/todos',
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
    expect(res.json().code).toBe('permission_denied')
  })

  it('returns 403 on PATCH /todos/:id without todo:edit', async () => {
    const [todo] = await testDb
      .insert(todos)
      .values(
        todoRow({
          title: 'T',
          description: 'D',
          content: 'C',
          date: new Date('2025-01-01'),
        })
      )
      .returning()
    const cookie = await createRestrictedSession([
      { resource: 'todos', action: 'view' },
    ])
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/todos/${todo.id}`,
      payload: { title: 'Updated' },
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('permission_denied')
  })

  it('returns 403 on DELETE /todos/:id without todo:delete', async () => {
    const [todo] = await testDb
      .insert(todos)
      .values(
        todoRow({
          title: 'T',
          description: 'D',
          content: 'C',
          date: new Date('2025-01-01'),
        })
      )
      .returning()
    const cookie = await createRestrictedSession([
      { resource: 'todos', action: 'view' },
    ])
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/todos/${todo.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('permission_denied')
  })
})
