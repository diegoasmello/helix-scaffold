import { inArray, or } from 'drizzle-orm'
import sanitizeHtml from 'sanitize-html'

import type { Database } from '@/db'
import { IMAGE_VARIANT_NAMES, uploads, variantKey } from '@/db/schema'

import { API_PREFIX } from './api-prefix'

const FILES_PATH = `${API_PREFIX}/files/`

// Only the path decides: the URL's origin is `BASE_URL` when it was written,
// which a later deploy may change.
const ANY_ORIGIN = 'http://any.origin'

/**
 * The URL of `src` when it shows a file from `GET /files/*` — whatever its
 * origin, or none —, else `null`. The one rule of what a stored file is:
 * `fileKeysInHtml()` and `stripFileOrigins()` both read it.
 *
 * Any origin on purpose: a page opened before a domain change saves its
 * images with the old `BASE_URL`, and they are still ours. The price: an
 * image another deploy of this API serves (`https://other.example/api/files/…`)
 * is taken for ours too — see `stripFileOrigins()`.
 */
function fileUrl(src: string): URL | null {
  let url: URL
  try {
    url = new URL(src, ANY_ORIGIN)
  } catch {
    return null
  }
  return url.pathname.startsWith(FILES_PATH) ? url : null
}

/**
 * Calls `visit` with the `src` of every `<img>` of `html` — as the browser
 * reads it, entities decoded — and returns the HTML with each `src` `visit`
 * replaced (`null` keeps it); `html` itself when none was.
 *
 * Parsed, never matched with a regex: a ` src=` written inside another
 * attribute (`alt=" src=/api/files/…"`) is part of that value, and rewriting
 * it there would close the attribute and open new ones (`onerror`) — on a
 * site that inserts the field as HTML. sanitize-html (htmlparser2) only
 * parses and serializes here: every tag and attribute passes, and the
 * serializer escapes each value it writes.
 */
function visitImageSources(
  html: string,
  visit: (src: string) => string | null
): string {
  let changed = false
  const result = sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    transformTags: {
      img: (tagName, attribs) => {
        const next = attribs.src === undefined ? null : visit(attribs.src)
        if (next === null || next === attribs.src) return { tagName, attribs }
        changed = true
        return { tagName, attribs: { ...attribs, src: next } }
      },
    },
  })
  return changed ? result : html
}

/**
 * The storage keys of the images `html` shows from `GET /files/*` — the
 * uploads a rich text field embeds (`RichTextEditor`'s `onUploadImage`).
 * Images under another path are left out; a key no upload owns (another
 * deploy's image, a deleted one) is dropped by `uploadIdsInHtml()`.
 */
export function fileKeysInHtml(html: string): string[] {
  const keys = new Set<string>()
  visitImageSources(html, (src) => {
    const url = fileUrl(src)
    if (!url) return null
    try {
      const key = decodeURIComponent(url.pathname.slice(FILES_PATH.length))
      if (key) keys.add(key)
    } catch {
      // A malformed escape names no stored file.
    }
    return null
  })
  return [...keys]
}

/**
 * `html` with the images it shows from `GET /files/*` addressed by path only:
 * `http://any.origin/api/files/a/original.png` → `/api/files/a/original.png`.
 * A rich text field is stored this way — after `sanitizeRichText()`, before
 * `uploadIdsInHtml()` — so a new `BASE_URL` (another domain) breaks none of
 * its images. Every read gives the origin back with `withFileOrigin()`.
 * Images under any other path are left as they are.
 *
 * Whatever the origin (`fileUrl()`): an image copied from another deploy of
 * this API comes back from this one's `BASE_URL`, where no upload has its
 * key — a broken image. Rare (text pasted between two products of the
 * scaffold), and the price of a domain change breaking nothing.
 */
export function stripFileOrigins(html: string): string {
  return visitImageSources(html, (src) => {
    const url = fileUrl(src)
    return url ? `${url.pathname}${url.search}${url.hash}` : null
  })
}

/**
 * `html` with `baseUrl` (the API's origin, `BASE_URL`) before every image
 * path `stripFileOrigins()` left: `/api/files/a/original.png` →
 * `https://api.example.com/api/files/a/original.png`. Every response that
 * returns a rich text field passes it through, so the admin and a site on
 * another domain get URLs they can load. Any other `src` — absolute, or a
 * path outside `/api/files/` — is left as it is.
 */
export function withFileOrigin(html: string, baseUrl: string): string {
  // Every read runs it (a list page: one per row). Stored HTML went through
  // sanitize-html, which writes a `src` literally (it escapes only `&<>"`),
  // so text without the path has no file to complete — skip the parse.
  if (!html.includes(FILES_PATH)) return html
  const origin = baseUrl.replace(/\/+$/, '')
  return visitImageSources(html, (src) =>
    src.startsWith(FILES_PATH) ? `${origin}${src}` : null
  )
}

/**
 * The ids of the uploads whose files `html` shows as images (the original or
 * an image variant). A key no upload owns — a deleted image — is left out: it
 * references nothing.
 *
 * Pass the result to `assertUsableUploads()` with the record's other upload
 * ids, then store it in the field's junction table — see
 * `src/modules/uploads/CLAUDE.md` → _Images inside rich text_.
 */
export async function uploadIdsInHtml(
  database: Database,
  html: string
): Promise<string[]> {
  const keys = fileKeysInHtml(html)
  if (keys.length === 0) return []

  const rows = await database
    .select({ id: uploads.id })
    .from(uploads)
    .where(
      or(
        inArray(uploads.storageKey, keys),
        ...IMAGE_VARIANT_NAMES.map((name) =>
          inArray(variantKey(uploads.variants, name), keys)
        )
      )
    )
  return [...new Set(rows.map((r) => r.id))]
}
