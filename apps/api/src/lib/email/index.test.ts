import { afterEach, describe, expect, it, vi } from 'vitest'

import { createEmailProvider } from './index'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('createEmailProvider', () => {
  it('refuses to fall back to the console in production', () => {
    expect(() =>
      createEmailProvider({
        enabled: true,
        from: 'a@b.test',
        nodeEnv: 'production',
      })
    ).toThrow(/RESEND_API_KEY is required/)
  })

  it('sends through Resend in production when the key is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null))
    vi.stubGlobal('fetch', fetchMock)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const provider = createEmailProvider({
      enabled: true,
      resendApiKey: 're_test',
      from: 'a@b.test',
      nodeEnv: 'production',
    })
    await provider.send('to@b.test', 'Subject', '<p>secret link</p>')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(log).not.toHaveBeenCalled()
  })

  it.each(['development', 'test'])(
    'prints the email to the console in %s without a key',
    async (nodeEnv) => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})

      const provider = createEmailProvider({
        enabled: true,
        from: 'a@b.test',
        nodeEnv,
      })
      await provider.send('to@b.test', 'Subject', '<p>dev link</p>')

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('<p>dev link</p>')
      )
    }
  )

  it.each(['production', 'development'])(
    'sends nothing when email is off (%s), with or without a key',
    async (nodeEnv) => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})

      for (const resendApiKey of [undefined, 're_test']) {
        const provider = createEmailProvider({
          enabled: false,
          resendApiKey,
          from: 'a@b.test',
          nodeEnv,
        })
        await provider.send('to@b.test', 'Subject', '<p>x</p>')
      }

      expect(fetchMock).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
    }
  )

  it('stays on the console in tests even with a key', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const provider = createEmailProvider({
      enabled: true,
      resendApiKey: 're_test',
      from: 'a@b.test',
      nodeEnv: 'test',
    })
    await provider.send('to@b.test', 'Subject', '<p>x</p>')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
