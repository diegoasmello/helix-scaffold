import type {
  PatchTodosIdMutationRequest,
  PostTodosMutationRequest,
  Todo,
  TodoStatusEnumKey,
  Upload,
} from '@helix/api-client/types'

export type UploadItem = Upload
export type TodoItem = Todo
export type TodoStatus = TodoStatusEnumKey
export type CreateTodoInput = PostTodosMutationRequest
export type UpdateTodoInput = PatchTodosIdMutationRequest

// Form-specific type — not an API type
export interface TodoFormValues {
  title: string
  description: string
  content: string
  date: string | null
  status: TodoStatus
  published: boolean
  attachments: UploadItem[]
  file: UploadItem | null
  image: UploadItem | null
}
