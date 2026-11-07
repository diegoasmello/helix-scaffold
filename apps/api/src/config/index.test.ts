import { afterEach, describe, expect, it, vi } from 'vitest'

import { testConfigOverrides } from './test-overrides'

// `@/config` resolves once, on first import: each test loads a fresh copy.
// A test that mocks `@/env` (production) must not leave it to the next one,
// even when it fails before its end — `resetModules()` keeps `doMock`s.
afterEach(() => {
  vi.doUnmock('@/env')
  vi.resetModules()
})

describe('E2E mode (src/scripts/e2e-server.ts)', () => {
  it('applies the test overrides, then moves the port, uploads and logs', async () => {
    vi.resetModules()
    const { enableE2E } = await import('./e2e-overrides')
    enableE2E()
    const { config } = await import('@/config')

    expect(config.registration).toEqual(testConfigOverrides.registration)
    expect(config.subscriptions.enabled).toBe(true)
    expect(config.subscriptions.plans).toEqual(
      testConfigOverrides.subscriptions?.plans
    )
    expect(config.server.port).toBe(3334)
    expect(config.uploads.dir).toBe('/tmp/helix-e2e-uploads')
    expect(config.logger.level).toBe('warn')
  })

  it('stays off unless enabled', async () => {
    vi.resetModules()
    const { config } = await import('@/config')

    expect(config.server.port).not.toBe(3334)
    expect(config.uploads.dir).toBe(testConfigOverrides.uploads?.dir)
  })
})

describe('email (email.enabled)', () => {
  it('refuses open registration without email', async () => {
    vi.resetModules()
    const { config, overrideConfig } = await import('@/config')

    expect(() =>
      overrideConfig(config, {
        registration: { mode: 'open' },
        email: { enabled: false },
      })
    ).toThrow(/registration.mode is 'open', but email.enabled is false/)
    expect(() =>
      overrideConfig(config, {
        registration: { mode: 'closed' },
        email: { enabled: false },
      })
    ).not.toThrow()
  })

  it('refuses email in production without RESEND_API_KEY', async () => {
    vi.resetModules()
    const { env } = await import('@/env')
    vi.doMock('@/env', () => ({
      env: { ...env, NODE_ENV: 'production', RESEND_API_KEY: undefined },
    }))
    // Resolved in production mode: app.config.ts as the product ships it.
    const { config, overrideConfig } = await import('@/config')

    expect(() => overrideConfig(config, { email: { enabled: true } })).toThrow(
      /email.enabled is true, but RESEND_API_KEY is not set/
    )
    expect(() =>
      overrideConfig(config, {
        registration: { mode: 'closed' },
        email: { enabled: false },
      })
    ).not.toThrow()
  })

  it('accepts email without a key outside production (console emails)', async () => {
    vi.resetModules()
    const { config, overrideConfig } = await import('@/config')

    expect(() =>
      overrideConfig(config, { email: { enabled: true } })
    ).not.toThrow()
  })
})
