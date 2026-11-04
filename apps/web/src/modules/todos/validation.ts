import {
  createValidator,
  maxLength,
  minFiles,
  required,
  requiredHtml,
} from '@helix/ui'

import type { TodoFormValues } from './types'

export const todoFormValidate = createValidator<TodoFormValues>()({
  title: [required, maxLength(200)],
  description: [required, maxLength(500)],
  content: [requiredHtml, maxLength(1000)],
  date: required,
  attachments: minFiles(1),
  file: required,
  image: required,
})
