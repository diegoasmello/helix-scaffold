import {
  createValidator,
  email,
  maxLength,
  minLength,
  required,
} from '@helix/ui'

import i18n from '../../i18n'
import type { UserFormValues, UserPasswordFormValues } from './types'

export const userCreateFormValidate = createValidator<UserFormValues>()({
  name: [required, maxLength(100)],
  email: [required, email],
  password: [required, minLength(8)],
})

export const userEditFormValidate = createValidator<UserFormValues>()({
  name: [required, maxLength(100)],
  email: [required, email],
})

// 8–128: the API's limits (`PUT /users/:id/password`)
export const userPasswordFormValidate =
  createValidator<UserPasswordFormValues>()({
    newPassword: [required, minLength(8), maxLength(128)],
    confirmPassword: (v, values) =>
      v !== values.newPassword
        ? i18n.t('password.passwordsNoMatch', { ns: 'users' })
        : null,
  })
