import { beforeEach, describe, expect, it } from 'vitest'

import { uploads } from '@/db/schema'
import { cleanupUploads, testDb } from '@/test/helpers'

import { fileKeysInHtml, uploadIdsInHtml } from './rich-text-uploads'

describe('fileKeysInHtml', () => {
  it.each([
    [
      'an absolute URL',
      '<img src="http://localhost:3333/api/files/a/original.png">',
      ['a/original.png'],
    ],
    [
      'another origin (BASE_URL changed)',
      '<img src="https://old.example.com/api/files/a/original.png">',
      ['a/original.png'],
    ],
    [
      'a relative URL',
      '<img src="/api/files/a/original.png">',
      ['a/original.png'],
    ],
    [
      'single quotes and other attributes',
      '<img alt="x" src=\'/api/files/a/medium.webp\' width="10">',
      ['a/medium.webp'],
    ],
    ['no quotes', '<img src=/api/files/a/small.webp>', ['a/small.webp']],
    [
      'an escaped key',
      '<img src="/api/files/a/my%20image.png">',
      ['a/my image.png'],
    ],
    [
      'the same image twice',
      '<img src="/api/files/a/x.png"><p>…</p><img src="/api/files/a/x.png">',
      ['a/x.png'],
    ],
    [
      'an image from elsewhere',
      '<img src="https://cdn.example.com/a/original.png">',
      [],
    ],
    ['a path outside /api/files', '<img src="/files/a/original.png">', []],
    ['a link, not an image', '<a href="/api/files/a/original.pdf">pdf</a>', []],
    ['data-src', '<img data-src="/api/files/a/original.png">', []],
    ['no image', '<p>Hello</p>', []],
  ])('%s', (_, html, keys) => {
    expect(fileKeysInHtml(html)).toEqual(keys)
  })
})

describe('uploadIdsInHtml', () => {
  beforeEach(async () => {
    await cleanupUploads()
  })

  async function insertImage() {
    const folder = crypto.randomUUID()
    const variant = (name: string) => ({
      key: `${folder}/${name}.webp`,
      url: `http://localhost:3333/api/files/${folder}/${name}.webp`,
    })
    const [upload] = await testDb
      .insert(uploads)
      .values({
        originalName: 'photo.png',
        mimeType: 'image/png',
        fileSize: 100,
        storageKey: `${folder}/original.png`,
        url: `http://localhost:3333/api/files/${folder}/original.png`,
        variants: {
          thumbnail: variant('thumbnail'),
          small: variant('small'),
          medium: variant('medium'),
          large: variant('large'),
        },
      })
      .returning()
    return upload
  }

  it('finds the upload of an original and of a variant', async () => {
    const [a, b] = await Promise.all([insertImage(), insertImage()])
    const html = `<img src="${a.url}"><img src="${b.variants!.medium.url}">`
    expect((await uploadIdsInHtml(testDb, html)).sort()).toEqual(
      [a.id, b.id].sort()
    )
  })

  it('counts an upload once when the text shows two of its files', async () => {
    const upload = await insertImage()
    const html = `<img src="${upload.url}"><img src="${upload.variants!.small.url}">`
    expect(await uploadIdsInHtml(testDb, html)).toEqual([upload.id])
  })

  it('leaves out a key no upload owns', async () => {
    const html = `<img src="/api/files/${crypto.randomUUID()}/original.png">`
    expect(await uploadIdsInHtml(testDb, html)).toEqual([])
  })
})
