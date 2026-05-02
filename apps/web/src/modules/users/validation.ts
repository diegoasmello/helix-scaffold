import type { UseFormInput } from '@helix/ui'

import type { UserFormValues } from './types'

const nameValidator = (v: string) =>
  !v.trim() ? 'Required' : v.length > 100 ? 'Max 100 characters' : null

const emailValidator = (v: string) => {
  if (!v.trim()) return 'Required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Invalid email'
  return null
}

export const userCreateFormValidate = {
  name: nameValidator,
  email: emailValidator,
  password: (v: string) =>
    !v.trim() ? 'Required' : v.length < 8 ? 'Min 8 characters' : null,
} satisfies UseFormInput<UserFormValues>['validate']

export const userEditFormValidate = {
  name: nameValidator,
  email: emailValidator,
} satisfies UseFormInput<UserFormValues>['validate']
