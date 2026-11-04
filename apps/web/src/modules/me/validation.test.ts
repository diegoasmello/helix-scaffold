import { describe, expect, it } from 'vitest'

import type {
  EmailChangeFormValues,
  MeFormValues,
  PasswordFormValues,
} from './types'
import {
  createEmailChangeFormValidate,
  meFormValidate,
  passwordFormValidate,
} from './validation'

const emailChangeFormValidate = createEmailChangeFormValidate('')

const meBase: MeFormValues = { name: '' }

describe('meFormValidate', () => {
  describe('name', () => {
    it('returns error when empty', () => {
      expect(meFormValidate.name('', meBase)).toBe('Required')
    })

    it('returns error when whitespace only', () => {
      expect(meFormValidate.name('   ', meBase)).toBe('Required')
    })

    it('returns null when valid', () => {
      expect(meFormValidate.name('John', meBase)).toBeNull()
    })
  })
})

const emailChangeBase: EmailChangeFormValues = {
  newEmail: '',
  currentPassword: '',
}

describe('emailChangeFormValidate — currentPassword', () => {
  it('is required when the account has a password', () => {
    const validate = createEmailChangeFormValidate('', true)
    expect(validate.currentPassword('', emailChangeBase)).toBe('Required')
    expect(validate.currentPassword('secret', emailChangeBase)).toBeNull()
  })

  it('is not asked of an account without one', () => {
    expect(
      emailChangeFormValidate.currentPassword('', emailChangeBase)
    ).toBeNull()
  })
})

describe('emailChangeFormValidate', () => {
  describe('newEmail', () => {
    it('returns error when empty', () => {
      expect(emailChangeFormValidate.newEmail('', emailChangeBase)).toBe(
        'Required'
      )
    })

    it('returns error when invalid format', () => {
      expect(
        emailChangeFormValidate.newEmail('not-an-email', emailChangeBase)
      ).toBe('Invalid email address')
    })

    it('returns null when valid', () => {
      expect(
        emailChangeFormValidate.newEmail('user@example.com', emailChangeBase)
      ).toBeNull()
    })
  })
})

const passwordBase: PasswordFormValues = {
  currentPassword: 'Password123!',
  newPassword: 'NewPass456!',
  confirmPassword: 'NewPass456!',
}

describe('passwordFormValidate', () => {
  describe('currentPassword', () => {
    it('returns error when empty', () => {
      expect(passwordFormValidate.currentPassword('', passwordBase)).toBe(
        'Required'
      )
    })

    it('returns null when provided', () => {
      expect(
        passwordFormValidate.currentPassword('anyvalue', passwordBase)
      ).toBeNull()
    })
  })

  describe('newPassword', () => {
    it('returns error when shorter than 8 chars', () => {
      expect(passwordFormValidate.newPassword('short', passwordBase)).toBe(
        'Min 8 characters'
      )
    })

    it('returns null when at least 8 chars', () => {
      expect(
        passwordFormValidate.newPassword('validpass', passwordBase)
      ).toBeNull()
    })
  })

  describe('confirmPassword', () => {
    it('returns error when does not match newPassword', () => {
      expect(
        passwordFormValidate.confirmPassword('different', {
          ...passwordBase,
          newPassword: 'NewPass456!',
        })
      ).toBe('Passwords do not match')
    })

    it('returns null when matches newPassword', () => {
      expect(
        passwordFormValidate.confirmPassword('NewPass456!', {
          ...passwordBase,
          newPassword: 'NewPass456!',
        })
      ).toBeNull()
    })
  })
})
