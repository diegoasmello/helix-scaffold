import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { todoAttachments } from '@/db/schema/todo-attachments'
import { todos } from '@/db/schema/todos'
import { uploads } from '@/db/schema/uploads'
import { env } from '@/env'
import {
  cleanupTodos,
  cleanupUploads,
  createTestApp,
  testDb,
  todoRow,
} from '@/test/helpers'

// No session anywhere in this file: the public API reads none.
const app = createTestApp()

beforeEach(async () => {
  await cleanupTodos()
  await cleanupUploads()
})

afterAll(async () => {
  await cleanupTodos()
  await cleanupUploads()
  await app.close()
})

async function insertUpload(name: string, mimeType: string) {
  const [upload] = await testDb
    .insert(uploads)
    .values({
      originalName: name,
      mimeType,
      fileSize: 100,
      storageKey: `test/${crypto.randomUUID()}/${name}`,
      url: `http://localhost:3333/api/files/test/${name}`,
      variants: null,
    })
    .returning()
  return upload
}

/** A todo; published (at `publishedAt`) unless `published: false`. */
async function insertTodo(
  values: Partial<Parameters<typeof todoRow>[0]> & {
    published?: boolean
    publishedAt?: Date
  } = {}
) {
  const { published = true, publishedAt = new Date(), ...rest } = values
  const [todo] = await testDb
    .insert(todos)
    .values(
      todoRow({
        title: 'A todo',
        description: 'Desc',
        content: '<p>Content</p>',
        date: '2025-01-01',
        ...rest,
        published,
        publishedAt: published ? publishedAt : null,
      })
    )
    .returning()
  return todo
}

function get(url: string) {
  return app.inject({ method: 'GET', url: `/api/public${url}` })
}

describe('GET /public/todos', () => {
  it('needs no session', async () => {
    const res = await get('/todos')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    })
  })

  it('lists published todos only, newest publication first', async () => {
    await insertTodo({ title: 'Old', publishedAt: new Date('2025-01-01') })
    await insertTodo({ title: 'Draft', published: false })
    await insertTodo({ title: 'New', publishedAt: new Date('2025-06-01') })

    const res = await get('/todos')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(2)
    expect(body.data.map((t: { title: string }) => t.title)).toEqual([
      'New',
      'Old',
    ])
  })

  it('paginates', async () => {
    for (let i = 1; i <= 3; i++) {
      await insertTodo({
        title: `T${i}`,
        publishedAt: new Date(`2025-0${i}-01`),
      })
    }
    const res = await get('/todos?page=2&pageSize=2')
    const body = res.json()
    expect(body.total).toBe(3)
    expect(body.totalPages).toBe(2)
    expect(body.data.map((t: { title: string }) => t.title)).toEqual(['T1'])
  })

  it('sorts by title and by date', async () => {
    await insertTodo({ title: 'Banana', date: '2025-01-02' })
    await insertTodo({ title: 'Árvore', date: '2025-01-03' })
    await insertTodo({ title: 'Cereja', date: '2025-01-01' })

    const byTitle = await get('/todos?sortBy=title&sortOrder=asc')
    expect(byTitle.json().data.map((t: { title: string }) => t.title)).toEqual([
      'Árvore',
      'Banana',
      'Cereja',
    ])
    const byDate = await get('/todos?sortBy=date&sortOrder=desc')
    expect(byDate.json().data.map((t: { title: string }) => t.title)).toEqual([
      'Árvore',
      'Banana',
      'Cereja',
    ])
  })

  it('searches the title and the description, published todos only', async () => {
    await insertTodo({ title: 'Comprar pão' })
    await insertTodo({ title: 'Other', description: 'Pão de queijo' })
    await insertTodo({ title: 'Pão secreto', published: false })
    await insertTodo({ title: 'Unrelated' })

    const res = await get('/todos?search=PAO')
    expect(
      res
        .json()
        .data.map((t: { title: string }) => t.title)
        .sort()
    ).toEqual(['Comprar pão', 'Other'])
    expect(res.json().total).toBe(2)
  })

  // Without sortOrder: the newest publication first, the others ascending.
  it('sorts title and date ascending by default', async () => {
    await insertTodo({ title: 'Banana', date: '2025-01-02' })
    await insertTodo({ title: 'Árvore', date: '2025-01-03' })
    await insertTodo({ title: 'Cereja', date: '2025-01-01' })

    const byTitle = await get('/todos?sortBy=title')
    expect(byTitle.json().data.map((t: { title: string }) => t.title)).toEqual([
      'Árvore',
      'Banana',
      'Cereja',
    ])
    const byDate = await get('/todos?sortBy=date')
    expect(byDate.json().data.map((t: { title: string }) => t.title)).toEqual([
      'Cereja',
      'Banana',
      'Árvore',
    ])
  })

  it('lists the oldest publication first when asked', async () => {
    await insertTodo({ title: 'Old', publishedAt: new Date('2025-01-01') })
    await insertTodo({ title: 'New', publishedAt: new Date('2025-06-01') })
    const res = await get('/todos?sortOrder=asc')
    expect(res.json().data.map((t: { title: string }) => t.title)).toEqual([
      'Old',
      'New',
    ])
  })

  it('refuses a sort column that is not public', async () => {
    const res = await get('/todos?sortBy=createdAt')
    expect(res.statusCode).toBe(400)
  })

  // The admin's filter language would reach columns a site has no business
  // querying: the parameter is not part of the public query.
  it('ignores the admin filters', async () => {
    await insertTodo({ title: 'Pending', status: 'pending' })
    await insertTodo({ title: 'Completed', status: 'completed' })
    const filters = JSON.stringify([
      { field: 'status', op: 'eq', value: 'completed' },
    ])
    const res = await get(`/todos?filters=${encodeURIComponent(filters)}`)
    expect(res.statusCode).toBe(200)
    expect(res.json().total).toBe(2)
  })

  it('caps the page size at 100', async () => {
    const res = await get('/todos?pageSize=101')
    expect(res.statusCode).toBe(400)
  })

  it('may be kept by a CDN', async () => {
    const res = await get('/todos')
    expect(res.headers['cache-control']).toBe('public, max-age=60')
  })
})

describe('GET /public/todos/:slug', () => {
  it('returns a published todo', async () => {
    await insertTodo({ title: 'Comprar pão', slug: 'comprar-pao' })
    const res = await get('/todos/comprar-pao')
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Comprar pão')
  })

  it('returns 404 for a draft, uncacheable', async () => {
    await insertTodo({ slug: 'draft', published: false })
    const res = await get('/todos/draft')
    expect(res.statusCode).toBe(404)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('returns 404 for an unknown slug', async () => {
    const res = await get('/todos/nope')
    expect(res.statusCode).toBe(404)
  })
})

describe('Images inside content', () => {
  // A site on another domain inserts the HTML as it comes: the images must
  // carry the API's origin, though the row keeps their path only.
  it('come with the absolute URL', async () => {
    const origin = env.BASE_URL.replace(/\/+$/, '')
    const external = '<img src="https://cdn.example.com/a.png" />'
    await insertTodo({
      slug: 'with-images',
      content: `<p>a</p><img src="/api/files/x/original.png" />${external}`,
    })
    const expected = `<p>a</p><img src="${origin}/api/files/x/original.png" />${external}`

    const detail = await get('/todos/with-images')
    expect(detail.json().content).toBe(expected)
    const list = await get('/todos')
    expect(list.json().data[0].content).toBe(expected)
  })
})

// Every field is listed on purpose: anything else is a leak.
describe('What a site sees', () => {
  it('returns the public fields only', async () => {
    const image = await insertUpload('photo.png', 'image/png')
    const file = await insertUpload('doc.pdf', 'application/pdf')
    const attachment = await insertUpload('internal.txt', 'text/plain')
    const publishedAt = new Date('2025-05-05T12:00:00Z')
    const todo = await insertTodo({
      title: 'Público',
      slug: 'publico',
      status: 'completed',
      imageId: image.id,
      fileId: file.id,
      publishedAt,
    })
    await testDb
      .insert(todoAttachments)
      .values({ todoId: todo.id, uploadId: attachment.id })

    const res = await get('/todos/publico')
    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(
      [
        'content',
        'date',
        'description',
        'file',
        'image',
        'publishedAt',
        'slug',
        'title',
        'updatedAt',
      ].sort()
    )
    expect(body.publishedAt).toBe(publishedAt.toISOString())
    // An upload: where to load it and what it is — no id, storage key,
    // original name or uploader.
    expect(body.image).toEqual({
      url: image.url,
      mimeType: 'image/png',
      fileSize: 100,
      variants: null,
    })
    expect(body.file).toEqual({
      url: file.url,
      mimeType: 'application/pdf',
      fileSize: 100,
      variants: null,
    })

    const list = await get('/todos')
    expect(Object.keys(list.json().data[0]).sort()).toEqual(
      Object.keys(body).sort()
    )
  })

  it('shows the image variants by URL only', async () => {
    const variant = (name: string) => ({
      key: `test/${name}.webp`,
      url: `http://localhost:3333/api/files/test/${name}.webp`,
    })
    const [image] = await testDb
      .insert(uploads)
      .values({
        originalName: 'photo.png',
        mimeType: 'image/png',
        fileSize: 100,
        storageKey: `test/${crypto.randomUUID()}/original.png`,
        url: 'http://localhost:3333/api/files/test/original.png',
        variants: {
          thumbnail: variant('thumbnail'),
          small: variant('small'),
          medium: variant('medium'),
          large: variant('large'),
        },
      })
      .returning()
    await insertTodo({ slug: 'with-image', imageId: image.id })

    const res = await get('/todos/with-image')
    expect(res.json().image.variants).toEqual({
      thumbnail: { url: variant('thumbnail').url },
      small: { url: variant('small').url },
      medium: { url: variant('medium').url },
      large: { url: variant('large').url },
    })
  })

  it('returns null for a missing image or file', async () => {
    await insertTodo({ slug: 'bare' })
    const res = await get('/todos/bare')
    expect(res.json().image).toBeNull()
    expect(res.json().file).toBeNull()
  })
})

describe('with the public API disabled', () => {
  const privateApp = createTestApp({ publicApi: { enabled: false } })

  afterAll(async () => {
    await privateApp.close()
  })

  it('serves no public route', async () => {
    await insertTodo({ slug: 'hidden' })
    for (const url of ['/api/public/todos', '/api/public/todos/hidden']) {
      const res = await privateApp.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(404)
    }
  })
})
