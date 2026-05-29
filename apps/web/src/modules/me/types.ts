import type {
  GetMeQueryResponse,
  PatchMeEmailMutationRequest,
  PatchMeMutationRequest,
  PatchMePasswordMutationRequest,
} from '@helix/api-client/types'

export type MeProfile = GetMeQueryResponse
export type UpdateMeInput = PatchMeMutationRequest
export type UpdateMeEmailInput = PatchMeEmailMutationRequest
export type UpdateMePasswordInput = PatchMePasswordMutationRequest

export interface MeFormValues {
  name: string
}

export interface EmailChangeFormValues {
  newEmail: string
}

export interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
