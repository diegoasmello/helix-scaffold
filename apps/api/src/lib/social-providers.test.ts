import { describe, expect, it } from 'vitest'

import {
  getConfiguredSocialProviders,
  getUsableSocialProviders,
} from './social-providers'

function settings(mode: 'open' | 'closed') {
  return {
    registration: { mode },
    auth: {
      socialProviders: {
        google: { enabled: true },
        facebook: { enabled: false },
        apple: { enabled: true },
      },
    },
  }
}

describe('getConfiguredSocialProviders', () => {
  it('lists the enabled providers in either mode', () => {
    expect(getConfiguredSocialProviders(settings('closed'))).toEqual([
      'google',
      'apple',
    ])
  })
})

describe('getUsableSocialProviders', () => {
  it('lists the enabled providers in open mode', () => {
    expect(getUsableSocialProviders(settings('open'))).toEqual([
      'google',
      'apple',
    ])
  })

  it('is empty in closed mode (email/password only)', () => {
    expect(getUsableSocialProviders(settings('closed'))).toEqual([])
  })
})
