import { afterEach, describe, expect, it, vi } from 'vitest'

import { testConfigOverrides } from './test-overrides'

// `@/config` resolves once, on first import: each test loads a fresh copy.
afterEach(() => {
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
