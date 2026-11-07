import type {
  PatchUsersIdMutationRequest,
  PostUsersMutationRequest,
  PutUsersIdPasswordMutationRequest,
  UserWithRole,
} from '@helix/api-client/types'

export type UserItem = UserWithRole
export type CreateUserInput = PostUsersMutationRequest
export type UpdateUserInput = PatchUsersIdMutationRequest
export type SetUserPasswordInput = PutUsersIdPasswordMutationRequest

// Form-specific type — not an API type
export interface UserFormValues {
  name: string
  email: string
  roleId: string | null
  password: string
}

// Change-password form (admin only) — `confirmPassword` never leaves the web
export interface UserPasswordFormValues {
  newPassword: string
  confirmPassword: string
}
