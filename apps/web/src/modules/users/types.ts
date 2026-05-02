import type {
  PatchUsersIdMutationRequest,
  PostUsersMutationRequest,
  User,
} from '@helix/api-client/types'

export type UserItem = User
export type CreateUserInput = PostUsersMutationRequest
export type UpdateUserInput = PatchUsersIdMutationRequest

// Form-specific type — not an API type
export interface UserFormValues {
  name: string
  email: string
  roleId: string | null
  password: string
}
