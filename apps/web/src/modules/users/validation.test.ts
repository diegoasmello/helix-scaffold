import { describe, expect, it } from 'vitest'

import type { UserFormValues } from './types'
import { userCreateFormValidate, userEditFormValidate } from './validation'

const base: UserFormValues = {
  name: '',
  email: '',
  roleId: null,
  password: '',
}

describe('userCreateFormValidate', () => {
  describe('name', () => {
    it('returns error when empty', () => {
      expect(userCreateFormValidate.name('', base)).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(userCreateFormValidate.name('   ', base)).toBe('Required')
    })

    it('returns error when exceeds 100 characters', () => {
      expect(userCreateFormValidate.name('a'.repeat(101), base)).toBe('Max 100 characters')
    })

    it('returns null when valid', () => {
      expect(userCreateFormValidate.name('Alice Silva', base)).toBeNull()
    })
  })

  describe('email', () => {
    it('returns error when empty', () => {
      expect(userCreateFormValidate.email('', base)).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(userCreateFormValidate.email('   ', base)).toBe('Required')
    })

    it('returns error when missing @', () => {
      expect(userCreateFormValidate.email('notanemail', base)).toBe('Invalid email address')
    })

    it('returns error when missing domain', () => {
      expect(userCreateFormValidate.email('user@', base)).toBe('Invalid email address')
    })

    it('returns null when valid', () => {
      expect(userCreateFormValidate.email('alice@example.com', base)).toBeNull()
    })
  })

  describe('password', () => {
    it('returns error when empty', () => {
      expect(userCreateFormValidate.password('', base)).toBe('Required')
    })

    it('returns error when only whitespace', () => {
      expect(userCreateFormValidate.password('   ', base)).toBe('Required')
    })

    it('returns error when shorter than 8 characters', () => {
      expect(userCreateFormValidate.password('short', base)).toBe('Min 8 characters')
    })

    it('returns null when valid', () => {
      expect(userCreateFormValidate.password('Password123!', base)).toBeNull()
    })
  })
})

describe('userEditFormValidate', () => {
  describe('name', () => {
    it('returns error when empty', () => {
      expect(userEditFormValidate.name('', base)).toBe('Required')
    })

    it('returns null when valid', () => {
      expect(userEditFormValidate.name('Alice Silva', base)).toBeNull()
    })
  })

  describe('email', () => {
    it('returns error when empty', () => {
      expect(userEditFormValidate.email('', base)).toBe('Required')
    })

    it('returns null when valid', () => {
      expect(userEditFormValidate.email('alice@example.com', base)).toBeNull()
    })
  })
})
