import { inArray, or, sql } from 'drizzle-orm'

import type { Database } from '@/db'
import { uploads } from '@/db/schema'

import { API_PREFIX } from './api-prefix'

// `<img … src="…">`, with the value in double, single or no quotes.
const IMG_SRC = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi

const FILES_PATH = `${API_PREFIX}/files/`

// Only the path: the URL's origin is `BASE_URL` when it was written, which a
// later deploy may change.
const ANY_ORIGIN = 'http://any.origin'

/**
 * The storage keys of the images `html` shows from `GET /files/*` — the
 * uploads a rich text field embeds (`RichTextEditor`'s `onUploadImage`).
 * Images from anywhere else are left out.
 */
export function fileKeysInHtml(html: string): string[] {
  const keys = new Set<string>()
  for (const match of html.matchAll(IMG_SRC)) {
    const src = (match[1] ?? match[2] ?? match[3]).replaceAll('&amp;', '&')
    let pathname: string
    try {
      pathname = new URL(src, ANY_ORIGIN).pathname
    } catch {
      continue
    }
    if (!pathname.startsWith(FILES_PATH)) continue
    try {
      const key = decodeURIComponent(pathname.slice(FILES_PATH.length))
      if (key) keys.add(key)
    } catch {
      // A malformed escape names no stored file.
    }
  }
  return [...keys]
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

  const variantKey = (variant: string) =>
    sql<string>`${uploads.variants} -> ${variant} ->> 'key'`
  const rows = await database
    .select({ id: uploads.id })
    .from(uploads)
    .where(
      or(
        inArray(uploads.storageKey, keys),
        ...['thumbnail', 'small', 'medium', 'large'].map((variant) =>
          inArray(variantKey(variant), keys)
        )
      )
    )
  return [...new Set(rows.map((r) => r.id))]
}
