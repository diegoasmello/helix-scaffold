import { createValidator, email, minLength, required } from '@helix/ui'

import type { MeFormValues, PasswordFormValues } from './types'

export const meFormValidate = createValidator<MeFormValues>()({
  name: [required],
  email: [required, email],
})

export const passwordFormValidate = createValidator<PasswordFormValues>()({
  currentPassword: [required],
  newPassword: [minLength(8)],
  confirmPassword: (v, values) =>
    v !== values.newPassword ? 'Passwords do not match' : null,
})
