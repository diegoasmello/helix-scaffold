import { beforeEach, describe, expect, it, vi } from 'vitest'

// A mutable stand-in for the frozen config, so both modes can be exercised.
const mockConfig = vi.hoisted(() => ({
  registration: { mode: 'open' as 'open' | 'closed' },
  auth: {
    socialProviders: {
      google: { enabled: true },
      facebook: { enabled: false },
      apple: { enabled: true },
    },
  },
}))

vi.mock('@/config', () => ({ config: mockConfig }))

const { getConfiguredSocialProviders, getUsableSocialProviders } =
  await import('./social-providers')

beforeEach(() => {
  mockConfig.registration.mode = 'open'
})

describe('getConfiguredSocialProviders', () => {
  it('lists the enabled providers in either mode', () => {
    mockConfig.registration.mode = 'closed'
    expect(getConfiguredSocialProviders()).toEqual(['google', 'apple'])
  })
})

describe('getUsableSocialProviders', () => {
  it('lists the enabled providers in open mode', () => {
    expect(getUsableSocialProviders()).toEqual(['google', 'apple'])
  })

  it('is empty in closed mode (email/password only)', () => {
    mockConfig.registration.mode = 'closed'
    expect(getUsableSocialProviders()).toEqual([])
  })
})
