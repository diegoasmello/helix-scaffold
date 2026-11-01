import { ApiError } from '@helix/api-client'

/** POST/PATCH /roles answered 409 `name_taken`: another role has this name. */
export function isRoleNameTaken(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'name_taken'
  )
}
