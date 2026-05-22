import { createValidator, email, maxLength, minLength, required } from '@helix/ui'

import type { UserFormValues } from './types'

export const userCreateFormValidate = createValidator<UserFormValues>()({
  name: [required, maxLength(100)],
  email: [required, email],
  password: [required, minLength(8)],
})

export const userEditFormValidate = createValidator<UserFormValues>()({
  name: [required, maxLength(100)],
  email: [required, email],
})
