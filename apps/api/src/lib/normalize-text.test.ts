import { describe, expect, it } from 'vitest'

import { normalizedValues, normalizeText } from './normalize-text'

describe('normalizeText', () => {
  // The table documents the rules: change a rule here and in the function together.
  it.each([
    ['lowercases', 'RÁPIDO Rápido', 'rapido rapido'],
    ['removes accents', 'Ação São Paulo àéîõü ñ', 'acao sao paulo aeiou n'],
    ['removes already-decomposed accents', 'Cafe\u0301', 'cafe'],
    [
      'undoes ligatures and full-width forms',
      'ﬁnança Ｆｕｌｌ',
      'financa full',
    ],
    [
      'maps letters that do not decompose',
      'Straße ẞ Øre Æon Œuvre Łódź Þór',
      'strasse ss ore aeon oeuvre lodz thor',
    ],
    [
      'maps typographic quotes and dashes',
      '“aspas” ‘simples’ — travessão – meia-risca',
      `"aspas" 'simples' - travessao - meia-risca`,
    ],
    ['lowercases without the server locale', 'İstanbul', 'istanbul'],
    [
      'lowercases what turns into capitals once decomposed',
      'ℌilbert 100㎒ ℻',
      'hilbert 100mhz fax',
    ],
    [
      'removes invisible format characters',
      'co\u00ADope zero\u200Bwidth mid\uFEFFbom',
      'coope zerowidth midbom',
    ],
    ['keeps non-latin scripts, lowercased', 'ΣΟΦΊΑ', 'σοφια'],
    [
      'collapses whitespace, tabs, line breaks and NBSP',
      '  linha\nnova\ttab\u00a0nbsp  ',
      'linha nova tab nbsp',
    ],
    [
      'keeps punctuation and LIKE wildcards',
      'e-mail 50%_off',
      'e-mail 50%_off',
    ],
    ['returns an empty string for blank input', ' \t\n', ''],
  ])('%s', (_, input, expected) => {
    expect(normalizeText(input)).toBe(expected)
  })

  it.each(['  Ação — “Straße”  ', 'ℌilbert', '100㎒', '℻', 'İẞ'])(
    'is idempotent for %j',
    (input) => {
      const once = normalizeText(input)
      expect(normalizeText(once)).toBe(once)
    }
  )
})

describe('normalizedValues', () => {
  const map = {
    title: 'normalizedTitle',
    description: 'normalizedDescription',
  } as const

  it('normalizes every mapped field', () => {
    expect(
      normalizedValues(
        { title: 'Ação', description: 'São Paulo', status: 'x' },
        map
      )
    ).toEqual({
      normalizedTitle: 'acao',
      normalizedDescription: 'sao paulo',
    })
  })

  it('leaves out the fields absent from a partial update', () => {
    const update: { title?: string; description?: string } = { title: 'Ação' }
    expect(normalizedValues(update, map)).toEqual({ normalizedTitle: 'acao' })
  })
})
