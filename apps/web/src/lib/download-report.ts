import { env } from '@/env'

const TIMEOUT_MS = 60_000

export async function downloadReport(
  path: string,
  filters: Record<string, string | undefined>,
  filename: string
): Promise<void> {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v != null)
    ) as Record<string, string>
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${env.VITE_API_URL}${path}?${params}`, {
      credentials: 'include',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Failed to generate report (${response.status}${detail ? `: ${detail}` : ''})`
    )
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
