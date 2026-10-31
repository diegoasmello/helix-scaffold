import { ApiError } from '@helix/api-client'
import { describe, expect, it } from 'vitest'

import { conflictMessageKey } from './api-errors'

describe('conflictMessageKey', () => {
  it('maps a live-subscription conflict', () => {
    const error = new ApiError('conflict', 409, 'live_subscription_exists')
    expect(conflictMessageKey(error)).toBe('notifications.alreadyLive')
  })

  it('maps an external id conflict', () => {
    const error = new ApiError('conflict', 409, 'external_id_taken')
    expect(conflictMessageKey(error)).toBe('notifications.externalIdTaken')
  })

  it('returns null for a 409 with an unknown code', () => {
    expect(
      conflictMessageKey(new ApiError('conflict', 409, 'other'))
    ).toBeNull()
  })

  it('returns null for other statuses and plain errors', () => {
    expect(conflictMessageKey(new ApiError('boom', 500))).toBeNull()
    expect(conflictMessageKey(new Error('boom'))).toBeNull()
  })
})
