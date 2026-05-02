import { describe, expect, it } from 'vitest'

import { roleFormValidate } from './validation'

describe('roleFormValidate', () => {
  describe('name', () => {
    it('returns error when empty', () => {
      expect(roleFormValidate.name('')).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(roleFormValidate.name('   ')).toBe('Required')
    })

    it('returns error when exceeds 100 characters', () => {
      expect(roleFormValidate.name('a'.repeat(101))).toBe('Max 100 characters')
    })

    it('returns null when valid', () => {
      expect(roleFormValidate.name('Admin')).toBeNull()
    })
  })

  describe('description', () => {
    it('returns error when empty', () => {
      expect(roleFormValidate.description('')).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(roleFormValidate.description('   ')).toBe('Required')
    })

    it('returns error when exceeds 300 characters', () => {
      expect(roleFormValidate.description('a'.repeat(301))).toBe(
        'Max 300 characters'
      )
    })

    it('returns null when valid', () => {
      expect(
        roleFormValidate.description('Full access to all features.')
      ).toBeNull()
    })
  })
})
