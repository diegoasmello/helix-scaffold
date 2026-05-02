import { describe, expect, it } from 'vitest'

import { userCreateFormValidate, userEditFormValidate } from './validation'

describe('userCreateFormValidate', () => {
  describe('name', () => {
    it('returns error when empty', () => {
      expect(userCreateFormValidate.name('')).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(userCreateFormValidate.name('   ')).toBe('Required')
    })

    it('returns error when exceeds 100 characters', () => {
      expect(userCreateFormValidate.name('a'.repeat(101))).toBe(
        'Max 100 characters'
      )
    })

    it('returns null when valid', () => {
      expect(userCreateFormValidate.name('Alice Silva')).toBeNull()
    })
  })

  describe('email', () => {
    it('returns error when empty', () => {
      expect(userCreateFormValidate.email('')).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(userCreateFormValidate.email('   ')).toBe('Required')
    })

    it('returns error when missing @', () => {
      expect(userCreateFormValidate.email('notanemail')).toBe('Invalid email')
    })

    it('returns error when missing domain', () => {
      expect(userCreateFormValidate.email('user@')).toBe('Invalid email')
    })

    it('returns null when valid', () => {
      expect(userCreateFormValidate.email('alice@example.com')).toBeNull()
    })
  })

  describe('password', () => {
    it('returns error when empty', () => {
      expect(userCreateFormValidate.password('')).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(userCreateFormValidate.password('   ')).toBe('Required')
    })

    it('returns error when shorter than 8 characters', () => {
      expect(userCreateFormValidate.password('short')).toBe('Min 8 characters')
    })

    it('returns null when valid', () => {
      expect(userCreateFormValidate.password('Password123!')).toBeNull()
    })
  })
})

describe('userEditFormValidate', () => {
  describe('name', () => {
    it('returns error when empty', () => {
      expect(userEditFormValidate.name('')).toBe('Required')
    })

    it('returns null when valid', () => {
      expect(userEditFormValidate.name('Alice Silva')).toBeNull()
    })
  })

  describe('email', () => {
    it('returns error when empty', () => {
      expect(userEditFormValidate.email('')).toBe('Required')
    })

    it('returns null when valid', () => {
      expect(userEditFormValidate.email('alice@example.com')).toBeNull()
    })
  })
})
