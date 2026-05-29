import { createValidator, email, minLength, required } from '@helix/ui'

import type {
  EmailChangeFormValues,
  MeFormValues,
  PasswordFormValues,
} from './types'

export const meFormValidate = createValidator<MeFormValues>()({
  name: [required],
})

export function createEmailChangeFormValidate(currentEmail: string) {
  return createValidator<EmailChangeFormValues>()({
    newEmail: [
      required,
      email,
      (v) =>
        v === currentEmail ? 'New email must differ from current email' : null,
    ],
  })
}

export const passwordFormValidate = createValidator<PasswordFormValues>()({
  currentPassword: [required],
  newPassword: [minLength(8)],
  confirmPassword: (v, values) =>
    v !== values.newPassword ? 'Passwords do not match' : null,
})
