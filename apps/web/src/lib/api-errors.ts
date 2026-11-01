import { ApiError } from '@helix/api-client'
import type { Namespace } from 'i18next'

import i18n from '../i18n'

/** The API's stable error `code` (`{ message, code }` body), if any. */
export function apiErrorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined
}

/**
 * What to tell the user about a failed request: the translation of the API's
 * `code` — `errors.<code>` in the module's namespace — when the namespace has
 * one, else `fallbackKey` (e.g. `notifications.createFailed`). Never the API's
 * raw `message`, which is English.
 *
 * A new code becomes translatable by adding `errors.<code>` to the module's
 * locale files (`en` and `pt-BR`) — no change in the component.
 */
export function apiErrorMessage(
  error: unknown,
  ns: Namespace,
  fallbackKey: string
): string {
  const code = apiErrorCode(error)
  const key =
    code && i18n.exists(`errors.${code}`, { ns })
      ? `errors.${code}`
      : fallbackKey
  // Codes come from the API at runtime, so the key can't be typed here.
  return (i18n.t as (key: string, options: { ns: Namespace }) => string)(key, {
    ns,
  })
}
