import { beforeEach, describe, expect, it } from 'vitest'

import { uploads } from '@/db/schema'
import { cleanupUploads, testDb } from '@/test/helpers'

import {
  fileKeysInHtml,
  stripFileOrigins,
  uploadIdsInHtml,
  withFileOrigin,
} from './rich-text-uploads'

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

// The case of a code review: a ` src=` inside another attribute (`alt`,
// `title` — the two text attributes an image keeps) is part of its value. A
// regex taking it for the attribute rewrote it in place, closed the value and
// left an `onerror` that ran on a site inserting the HTML.
const TEXT_ATTRIBUTES = ['alt', 'title']

/** An image whose `attribute` hides a ` src=` — the one the browser ignores. */
const srcInside = (attribute: string, hidden: string, src: string) =>
  `<img ${attribute}=" src=${hidden}" src="${src}" />`

const xssIn = (attribute: string) =>
  srcInside(
    attribute,
    '/api/files/x/onerror=alert(1)//',
    'https://e.com/404.png'
  )

describe.each(TEXT_ATTRIBUTES)('a src written inside %s', (attribute) => {
  it('is no image to fileKeysInHtml', () => {
    expect(fileKeysInHtml(xssIn(attribute))).toEqual([])
    expect(
      fileKeysInHtml(srcInside(attribute, '/api/files/x', '/api/files/a/b.png'))
    ).toEqual(['a/b.png'])
  })

  it('is never rewritten by stripFileOrigins', () => {
    const external = srcInside(
      attribute,
      'https://x.com/api/files/a',
      'https://e.com/b.png'
    )
    expect(stripFileOrigins(external)).toBe(external)
    expect(
      stripFileOrigins(
        srcInside(
          attribute,
          'https://x.com/api/files/a',
          'https://a.example/api/files/b.png'
        )
      )
    ).toBe(
      srcInside(attribute, 'https://x.com/api/files/a', '/api/files/b.png')
    )
  })

  it('is never written into by withFileOrigin', () => {
    const read = withFileOrigin(xssIn(attribute), 'https://api.example.com')
    expect(read).toBe(xssIn(attribute))
    expect(read).not.toContain('"https://api.example.com')
    expect(
      withFileOrigin(
        srcInside(attribute, '/api/files/x', '/api/files/a/b.png'),
        'https://api.example.com'
      )
    ).toBe(
      srcInside(
        attribute,
        '/api/files/x',
        'https://api.example.com/api/files/a/b.png'
      )
    )
  })
})

describe('stripFileOrigins', () => {
  it.each([
    [
      'the origin it was written with',
      '<img src="http://localhost:3333/api/files/a/original.png" />',
      '<img src="/api/files/a/original.png" />',
    ],
    [
      'any other origin',
      '<img src="https://old.example.com/api/files/a/medium.webp" alt="x" />',
      '<img src="/api/files/a/medium.webp" alt="x" />',
    ],
    [
      'single quotes',
      '<img alt="x" src=\'https://a.example/api/files/a/small.webp\' width="10">',
      '<img alt="x" src="/api/files/a/small.webp" width="10" />',
    ],
    [
      'no quotes',
      '<img src=https://a.example/api/files/a/small.webp>',
      '<img src="/api/files/a/small.webp" />',
    ],
    [
      'a query with &amp;, kept escaped',
      '<img src="https://a.example/api/files/a/x.png?v=1&amp;w=2#top" />',
      '<img src="/api/files/a/x.png?v=1&amp;w=2#top" />',
    ],
    [
      'an escaped key',
      '<img src="https://a.example/api/files/a/my%20image.png" />',
      '<img src="/api/files/a/my%20image.png" />',
    ],
    [
      'every image of the text',
      '<img src="https://a.example/api/files/a/x.png" /><p>…</p><img src="http://b.example:8080/api/files/b/y.png" />',
      '<img src="/api/files/a/x.png" /><p>…</p><img src="/api/files/b/y.png" />',
    ],
  ])('removes %s', (_, html, stored) => {
    expect(stripFileOrigins(html)).toBe(stored)
  })

  it.each([
    ['an image from elsewhere', '<img src="https://cdn.example.com/a/b.png">'],
    ['a path outside /api/files', '<img src="https://a.example/files/a.png">'],
    [
      'a link, not an image',
      '<a href="https://a.example/api/files/a.pdf">x</a>',
    ],
    ['data-src', '<img data-src="https://a.example/api/files/a/x.png">'],
    ['a path already', '<img src=\'/api/files/a/x.png\' alt="x">'],
    ['an image without src', '<img />'],
    ['no image', '<p>Hello</p>'],
  ])('leaves %s as it is', (_, html) => {
    expect(stripFileOrigins(html)).toBe(html)
  })

  // A trade-off, documented in `stripFileOrigins()`: the path decides, so an
  // image another deploy of this API serves is taken for one of ours.
  it("takes another deploy's /api/files image for one of ours", () => {
    expect(
      stripFileOrigins('<img src="https://other.example/api/files/k.png" />')
    ).toBe('<img src="/api/files/k.png" />')
  })

  it('changes nothing but the src in what sanitizeRichText writes', () => {
    const rest =
      '<h2 style="text-align:center">T</h2><p>a &amp; b &lt;c&gt; <a href="https://x.co/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer nofollow">l</a></p><pre><code class="language-ts">a &lt; b</code></pre>'
    expect(
      stripFileOrigins(
        `${rest}<img src="https://a.example/api/files/a/x.png" alt="Alt" />`
      )
    ).toBe(`${rest}<img src="/api/files/a/x.png" alt="Alt" />`)
  })

  it('finds the keys fileKeysInHtml finds, before and after', () => {
    const html =
      '<img src="https://a.example/api/files/a/x.png" /><img src="https://cdn.example.com/b.png" />'
    expect(fileKeysInHtml(stripFileOrigins(html))).toEqual(fileKeysInHtml(html))
  })

  it('is idempotent', () => {
    const once = stripFileOrigins(
      '<img src="https://a.example/api/files/a/x.png" /><img src="https://cdn.example.com/b.png" />'
    )
    expect(stripFileOrigins(once)).toBe(once)
  })
})

describe('withFileOrigin', () => {
  it.each([
    ['without a trailing slash', 'https://api.example.com'],
    ['with a trailing slash', 'https://api.example.com/'],
  ])('prefixes the base URL %s', (_, baseUrl) => {
    expect(withFileOrigin('<img src="/api/files/a/x.png" />', baseUrl)).toBe(
      '<img src="https://api.example.com/api/files/a/x.png" />'
    )
  })

  it('prefixes every image of the text, whatever its quotes', () => {
    expect(
      withFileOrigin(
        '<img src=\'/api/files/a/x.png?v=1&amp;w=2\' alt="x"><p>…</p><img src=/api/files/b/y.png>',
        'http://localhost:3333'
      )
    ).toBe(
      '<img src="http://localhost:3333/api/files/a/x.png?v=1&amp;w=2" alt="x" /><p>…</p><img src="http://localhost:3333/api/files/b/y.png" />'
    )
  })

  it.each([
    ['an image from elsewhere', '<img src="https://cdn.example.com/a/b.png">'],
    ['a relative path outside /api/files', '<img src="/files/a/x.png">'],
    ['a link, not an image', '<a href="/api/files/a.pdf">x</a>'],
    ['no image', '<p>Hello</p>'],
  ])('leaves %s as it is', (_, html) => {
    expect(withFileOrigin(html, 'https://api.example.com')).toBe(html)
  })

  it('is idempotent: an absolute URL is not touched', () => {
    const once = withFileOrigin(
      '<img src="/api/files/a/x.png" />',
      'https://api.example.com'
    )
    expect(withFileOrigin(once, 'https://other.example.com')).toBe(once)
  })

  it('gives back what stripFileOrigins took, with the new origin', () => {
    const stored = stripFileOrigins(
      '<p>a</p><img src="https://old.example.com/api/files/a/x.png" />'
    )
    expect(withFileOrigin(stored, 'https://new.example.com')).toBe(
      '<p>a</p><img src="https://new.example.com/api/files/a/x.png" />'
    )
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

  it('finds them by path, as the text is stored', async () => {
    const upload = await insertImage()
    const html = stripFileOrigins(
      `<img src="${upload.url}"><img src="${upload.variants!.small.url}">`
    )
    expect(html).not.toContain('localhost')
    expect(await uploadIdsInHtml(testDb, html)).toEqual([upload.id])
  })

  it('leaves out a key no upload owns', async () => {
    const html = `<img src="/api/files/${crypto.randomUUID()}/original.png">`
    expect(await uploadIdsInHtml(testDb, html)).toEqual([])
  })
})
