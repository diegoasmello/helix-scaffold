import type { UseFormInput } from '@helix/ui'

import type { RoleFormValues } from './types'

export const roleFormValidate = {
  name: (v: string) =>
    !v.trim() ? 'Required' : v.length > 100 ? 'Max 100 characters' : null,
  description: (v: string) =>
    !v.trim() ? 'Required' : v.length > 300 ? 'Max 300 characters' : null,
} satisfies UseFormInput<RoleFormValues>['validate']
