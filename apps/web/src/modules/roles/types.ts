import type {
  PatchRolesIdMutationRequest,
  PostRolesMutationRequest,
  Role,
} from '@helix/api-client/types'

export type RoleItem = Role
export type CreateRoleInput = PostRolesMutationRequest
export type UpdateRoleInput = PatchRolesIdMutationRequest

// Form-specific type — not an API type
export interface RoleFormValues {
  name: string
  description: string
}
