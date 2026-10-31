import { afterEach, describe, expect, it } from 'vitest'

import i18n from '../i18n'
import { formatDate, formatDateTime, formatTime } from './date'

// Built from local components so the result does not depend on the TZ.
const date = new Date(2026, 0, 15, 14, 30)

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('formatDate', () => {
  it.each([
    ['short', '1/15/26'],
    ['medium', 'Jan 15, 2026'],
    ['long', 'January 15, 2026'],
    ['full', 'Thursday, January 15, 2026'],
  ] as const)('formats the %s style in English', (style, expected) => {
    expect(formatDate(date, style)).toBe(expected)
  })

  it('follows the current i18n language', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(formatDate(date, 'short')).toBe('15/01/2026')
    expect(formatDate(date, 'long')).toBe('15 de janeiro de 2026')
  })
})

describe('formatTime', () => {
  it('formats a short time in English', () => {
    expect(formatTime(date)).toMatch(/^2:30\sPM$/)
  })

  it('uses the 24-hour clock in Portuguese', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(formatTime(date)).toBe('14:30')
  })
})

describe('formatDateTime', () => {
  it('formats short date and time in English', () => {
    expect(formatDateTime(date)).toMatch(/^1\/15\/26,\s2:30\sPM$/)
  })

  it('follows the current i18n language', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(formatDateTime(date)).toBe('15/01/2026, 14:30')
  })
})
