export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<void>
}

function createResendEmailProvider(
  apiKey: string,
  from: string
): EmailProvider {
  return {
    async send(to, subject, html) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to, subject, html }),
      })
      if (!response.ok) {
        const body = await response.text()
        console.error(`Resend API error ${response.status}:`, body)
        throw new Error(`Email delivery failed (status ${response.status})`)
      }
    },
  }
}

function createConsoleEmailProvider(): EmailProvider {
  return {
    async send(to, subject, html) {
      console.log(`[EMAIL] To: ${to} | Subject: ${subject}\n${html}`)
    },
  }
}

/**
 * Resend when `RESEND_API_KEY` is set (outside tests), the console otherwise.
 * Throws in production without a key: the console provider prints every email
 * body — live password-reset and verification links included — to stdout, so
 * a production API must never fall back to it.
 */
export function createEmailProvider(options: {
  resendApiKey?: string
  from: string
  nodeEnv: string
}): EmailProvider {
  if (options.nodeEnv !== 'test' && options.resendApiKey) {
    return createResendEmailProvider(options.resendApiKey, options.from)
  }
  if (options.nodeEnv === 'production') {
    throw new Error(
      'RESEND_API_KEY is required when NODE_ENV=production: without it, emails would be printed to stdout with their reset and verification links'
    )
  }
  return createConsoleEmailProvider()
}
