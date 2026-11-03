/**
 * Normalized text columns: a searchable copy of a text column, written by the
 * service on every insert and update (`title` → `normalizedTitle`). The list's
 * search box and the `contains`/`startsWith`/`endsWith` filters compare the
 * normalized term with it, so `acao` finds `Ação` and `SAO  paulo` finds
 * `São Paulo`. See `apps/api/CLAUDE.md` → _Normalized text columns_.
 *
 * Changing these rules changes every stored value: existing rows keep the old
 * normalization until they are rewritten, so a change ships with a backfill.
 */

/**
 * Letters and punctuation that Unicode does not decompose into a base letter
 * plus a mark, so NFKD + mark removal leaves them as they are.
 */
const SPECIAL_CHARACTERS: Readonly<Record<string, string>> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  '“': '"',
  '”': '"',
  '„': '"',
  '‘': "'",
  '’': "'",
  '–': '-',
  '—': '-',
}

const SPECIAL_CHARACTERS_RE = new RegExp(
  `[${Object.keys(SPECIAL_CHARACTERS).join('')}]`,
  'g'
)

/**
 * The searchable form of a text, in this order:
 *
 * 1. `toLowerCase()`: case-insensitive, and locale-independent (unlike
 *    `toLocaleLowerCase`), so the server's locale never changes the result.
 *    Before NFKD, so `İ` becomes `i` + a dot mark that step 3 removes.
 * 2. NFKD: splits accented letters into letter + mark, and turns
 *    compatibility forms into plain ones (`ﬁ` → `fi`, full-width `Ａ` → `a`).
 *    Also covers text pasted with already-decomposed accents (macOS).
 * 3. Removes the marks: `ação` → `acao`.
 * 4. `toLowerCase()` again: some characters only turn into capitals once
 *    decomposed (`ℌ` → `H`, `㎒` → `MHz`, `℻` → `FAX`). The first pass stays,
 *    for `İ` and `ẞ`. Without it the function would not be idempotent.
 * 5. Maps what does not decompose (`ß` → `ss`, `ø` → `o`, typographic quotes
 *    and dashes → ASCII).
 * 6. Removes invisible format characters (`\p{Cf}`: soft hyphen, zero-width
 *    space, BOM, direction marks), common in text pasted from Word or the web.
 * 7. Collapses any run of whitespace (tabs, line breaks, NBSP) into one space
 *    and trims the ends.
 *
 * Punctuation is kept on purpose: removing it would make `contains` match
 * across words (`e-mail` ↔ `email`), and the term must stay escapable.
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(SPECIAL_CHARACTERS_RE, (char) => SPECIAL_CHARACTERS[char])
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Maps a source field to the column that stores its normalized form, e.g.
 * `{ title: 'normalizedTitle' }`. Declared once per module, next to the table.
 */
export type NormalizedFieldMap<TSource extends string = string> = Readonly<
  Partial<Record<TSource, string>>
>

/**
 * The normalized columns for the fields present in `input`. A required source
 * field gives a required column, an optional one an optional column, so the
 * same call fits both the insert (every column) and a partial update (only
 * the fields sent):
 *
 * ```ts
 * database.insert(todos).values({ ...data, ...normalizedValues(data, TODO_NORMALIZED_FIELDS) })
 * database.update(todos).set({ ...data, ...normalizedValues(data, TODO_NORMALIZED_FIELDS) })
 * ```
 */
export type NormalizedValues<TInput, TMap> = {
  [K in keyof TInput as K extends keyof TMap
    ? TMap[K] extends string
      ? TMap[K]
      : never
    : never]: string
}

export function normalizedValues<
  TInput extends object,
  const TMap extends NormalizedFieldMap<Extract<keyof TInput, string>>,
>(input: TInput, map: TMap): NormalizedValues<TInput, TMap> {
  const values: Record<string, string> = {}
  for (const [source, target] of Object.entries(map)) {
    const value = (input as Record<string, unknown>)[source]
    if (typeof value === 'string' && target) {
      values[target as string] = normalizeText(value)
    }
  }
  return values as NormalizedValues<TInput, TMap>
}
