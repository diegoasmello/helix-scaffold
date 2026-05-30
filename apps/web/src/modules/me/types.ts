import type {
  GetMeQueryResponse,
  PatchMeEmailMutationRequest,
  PatchMeMutationRequest,
  PatchMePasswordMutationRequest,
  PostMeSetPasswordMutationRequest,
} from '@helix/api-client/types'

export type MeProfile = GetMeQueryResponse
export type UpdateMeInput = PatchMeMutationRequest
export type UpdateMeEmailInput = PatchMeEmailMutationRequest
export type UpdateMePasswordInput = PatchMePasswordMutationRequest
export type SetPasswordInput = PostMeSetPasswordMutationRequest

export interface LinkedAccount {
  id: string
  providerId: string
  accountId: string
  createdAt: Date
  scopes?: string[] | null
}

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

export interface SetPasswordFormValues {
  newPassword: string
  confirmPassword: string
}
