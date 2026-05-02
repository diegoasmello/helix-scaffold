import type { UseFormInput } from '@helix/ui'

import type { TodoFormValues } from './types'

export const todoFormValidate = {
  title: (v: string) =>
    !v.trim() ? 'Required' : v.length > 200 ? 'Max 200 characters' : null,
  description: (v: string) =>
    !v.trim() ? 'Required' : v.length > 500 ? 'Max 500 characters' : null,
  content: (v: string) =>
    !v.trim() ? 'Required' : v.length > 1000 ? 'Max 1000 characters' : null,
  date: (v: string | null) => (!v ? 'Required' : null),
} satisfies UseFormInput<TodoFormValues>['validate']
