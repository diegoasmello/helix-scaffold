import { ApiError } from '@helix/api-client'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '../i18n'
import { apiErrorCode, apiErrorMessage } from './api-errors'

afterEach(async () => {
  await i18n.changeLanguage('en')
})

const emailTaken = new ApiError('Email already in use', 409, 'email_taken')

describe('apiErrorCode', () => {
  it("returns the API's code", () => {
    expect(apiErrorCode(emailTaken)).toBe('email_taken')
  })

  it('is undefined for other errors', () => {
    expect(apiErrorCode(new Error('network'))).toBeUndefined()
    expect(apiErrorCode(new ApiError('Server error', 500))).toBeUndefined()
  })
})

describe('apiErrorMessage', () => {
  it('translates a code the namespace knows (errors.<code>)', () => {
    expect(
      apiErrorMessage(emailTaken, 'users', 'notifications.createFailed')
    ).toBe('This email is already used by another user.')
  })

  it('follows the current language', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(
      apiErrorMessage(emailTaken, 'users', 'notifications.createFailed')
    ).toBe('Este email já está em uso por outro usuário.')
  })

  it('falls back for a code the namespace does not know', () => {
    const unknown = new ApiError('Nope', 409, 'something_else')
    expect(
      apiErrorMessage(unknown, 'users', 'notifications.createFailed')
    ).toBe('Failed to create user')
  })

  it('falls back for an error without a code — never the raw API message', () => {
    const raw = new ApiError('Internal details', 500)
    expect(apiErrorMessage(raw, 'users', 'notifications.createFailed')).toBe(
      'Failed to create user'
    )
  })
})
