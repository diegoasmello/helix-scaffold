import { describe, expect, it } from 'vitest'

import type { PasswordFormValues } from './types'
import { meFormValidate, passwordFormValidate } from './validation'

describe('meFormValidate', () => {
  describe('name', () => {
    it('returns error when empty', () => {
      expect(meFormValidate.name('')).toBe('Required')
    })

    it('returns error when whitespace only', () => {
      expect(meFormValidate.name('   ')).toBe('Required')
    })

    it('returns null when valid', () => {
      expect(meFormValidate.name('John')).toBeNull()
    })
  })

  describe('email', () => {
    it('returns error when empty', () => {
      expect(meFormValidate.email('')).toBe('Required')
    })

    it('returns error when invalid format', () => {
      expect(meFormValidate.email('not-an-email')).toBe('Invalid email')
    })

    it('returns null when valid', () => {
      expect(meFormValidate.email('user@example.com')).toBeNull()
    })
  })
})

describe('passwordFormValidate', () => {
  const base: PasswordFormValues = {
    currentPassword: 'Password123!',
    newPassword: 'NewPass456!',
    confirmPassword: 'NewPass456!',
  }

  describe('currentPassword', () => {
    it('returns error when empty', () => {
      expect(passwordFormValidate.currentPassword('')).toBe('Required')
    })

    it('returns null when provided', () => {
      expect(passwordFormValidate.currentPassword('anyvalue')).toBeNull()
    })
  })

  describe('newPassword', () => {
    it('returns error when shorter than 8 chars', () => {
      expect(passwordFormValidate.newPassword('short')).toBe('Min 8 characters')
    })

    it('returns null when at least 8 chars', () => {
      expect(passwordFormValidate.newPassword('validpass')).toBeNull()
    })
  })

  describe('confirmPassword', () => {
    it('returns error when does not match newPassword', () => {
      expect(
        passwordFormValidate.confirmPassword('different', {
          ...base,
          newPassword: 'NewPass456!',
        })
      ).toBe('Passwords do not match')
    })

    it('returns null when matches newPassword', () => {
      expect(
        passwordFormValidate.confirmPassword('NewPass456!', {
          ...base,
          newPassword: 'NewPass456!',
        })
      ).toBeNull()
    })
  })
})
