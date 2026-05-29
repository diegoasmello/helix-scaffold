export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<void>
}

function createResendEmailProvider(apiKey: string, from: string): EmailProvider {
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

export function createEmailProvider(env: {
  RESEND_API_KEY?: string
  EMAIL_FROM: string
  NODE_ENV: string
}): EmailProvider {
  if (env.NODE_ENV !== 'test' && env.RESEND_API_KEY) {
    return createResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM)
  }
  return createConsoleEmailProvider()
}
