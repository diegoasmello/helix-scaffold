import { describe, expect, it } from 'vitest'

import type { UserFormValues, UserPasswordFormValues } from './types'
import {
  userCreateFormValidate,
  userEditFormValidate,
  userPasswordFormValidate,
} from './validation'

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
      expect(userCreateFormValidate.name('a'.repeat(101), base)).toBe(
        'Max 100 characters'
      )
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
      expect(userCreateFormValidate.email('notanemail', base)).toBe(
        'Invalid email address'
      )
    })

    it('returns error when missing domain', () => {
      expect(userCreateFormValidate.email('user@', base)).toBe(
        'Invalid email address'
      )
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
      expect(userCreateFormValidate.password('short', base)).toBe(
        'Min 8 characters'
      )
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

describe('userPasswordFormValidate', () => {
  const values: UserPasswordFormValues = {
    newPassword: 'NewPassword1!',
    confirmPassword: 'NewPassword1!',
  }

  describe('newPassword', () => {
    it('returns error when empty', () => {
      expect(userPasswordFormValidate.newPassword('', values)).toBe('Required')
    })

    it('returns error when shorter than 8 characters', () => {
      expect(userPasswordFormValidate.newPassword('a'.repeat(7), values)).toBe(
        'Min 8 characters'
      )
    })

    it('returns error when longer than 128 characters', () => {
      expect(
        userPasswordFormValidate.newPassword('a'.repeat(129), values)
      ).toBe('Max 128 characters')
    })

    it('returns null at 8 characters', () => {
      expect(
        userPasswordFormValidate.newPassword('a'.repeat(8), values)
      ).toBeNull()
    })
  })

  describe('confirmPassword', () => {
    it('returns error when it differs from the new password', () => {
      expect(
        userPasswordFormValidate.confirmPassword('Other1234!', values)
      ).toBe("The passwords don't match")
    })

    it('returns null when it matches', () => {
      expect(
        userPasswordFormValidate.confirmPassword('NewPassword1!', values)
      ).toBeNull()
    })
  })
})
