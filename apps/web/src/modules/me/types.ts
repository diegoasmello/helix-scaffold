import type {
  GetMeQueryResponse,
  PatchMeMutationRequest,
  PatchMePasswordMutationRequest,
} from '@helix/api-client/types'

export type MeProfile = GetMeQueryResponse
export type UpdateMeInput = PatchMeMutationRequest
export type UpdateMePasswordInput = PatchMePasswordMutationRequest

export interface MeFormValues {
  name: string
  email: string
}

export interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
