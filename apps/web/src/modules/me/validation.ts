import type { UseFormInput } from '@helix/ui'

import type { MeFormValues, PasswordFormValues } from './types'

export const meFormValidate = {
  name: (v: string) => (!v.trim() ? 'Required' : null),
  email: (v: string) => {
    if (!v.trim()) return 'Required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Invalid email'
    return null
  },
} satisfies UseFormInput<MeFormValues>['validate']

export const passwordFormValidate = {
  currentPassword: (v: string) => (!v ? 'Required' : null),
  newPassword: (v: string) => (v.length < 8 ? 'Min 8 characters' : null),
  confirmPassword: (v: string, values: PasswordFormValues) =>
    v !== values.newPassword ? 'Passwords do not match' : null,
} satisfies UseFormInput<PasswordFormValues>['validate']
