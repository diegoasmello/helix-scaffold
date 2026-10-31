import { ApiError } from '@helix/api-client'

// 409 codes returned by POST/PATCH /subscriptions (unique-index violations).
const CONFLICT_MESSAGE_KEYS = {
  live_subscription_exists: 'notifications.alreadyLive',
  external_id_taken: 'notifications.externalIdTaken',
} as const

/** The i18n key explaining a subscription conflict, or null for other errors. */
export function conflictMessageKey(
  error: unknown
): (typeof CONFLICT_MESSAGE_KEYS)[keyof typeof CONFLICT_MESSAGE_KEYS] | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  return (
    CONFLICT_MESSAGE_KEYS[error.code as keyof typeof CONFLICT_MESSAGE_KEYS] ??
    null
  )
}
