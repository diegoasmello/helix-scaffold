import type {
  PatchTodosIdMutationRequest,
  PostTodosMutationRequest,
  Todo,
  TodoStatusEnumKey,
} from '@helix/api-client/types'

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
}
