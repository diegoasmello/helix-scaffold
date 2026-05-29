import { describe, expect, it } from 'vitest'

import type { RoleFormValues } from './types'
import { roleFormValidate } from './validation'

const base: RoleFormValues = {
  name: '',
  description: '',
}

describe('roleFormValidate', () => {
  describe('name', () => {
    it('returns error when empty', () => {
      expect(roleFormValidate.name('', base)).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(roleFormValidate.name('   ', base)).toBe('Required')
    })

    it('returns error when exceeds 100 characters', () => {
      expect(roleFormValidate.name('a'.repeat(101), base)).toBe(
        'Max 100 characters'
      )
    })

    it('returns null when valid', () => {
      expect(roleFormValidate.name('Admin', base)).toBeNull()
    })
  })

  describe('description', () => {
    it('returns error when empty', () => {
      expect(roleFormValidate.description('', base)).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(roleFormValidate.description('   ', base)).toBe('Required')
    })

    it('returns error when exceeds 300 characters', () => {
      expect(roleFormValidate.description('a'.repeat(301), base)).toBe(
        'Max 300 characters'
      )
    })

    it('returns null when valid', () => {
      expect(
        roleFormValidate.description('Full access to all features.', base)
      ).toBeNull()
    })
  })
})
