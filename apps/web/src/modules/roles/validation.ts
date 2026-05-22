import { createValidator, maxLength, required } from '@helix/ui'

import type { RoleFormValues } from './types'

export const roleFormValidate = createValidator<RoleFormValues>()({
  name: [required, maxLength(100)],
  description: [required, maxLength(300)],
})
