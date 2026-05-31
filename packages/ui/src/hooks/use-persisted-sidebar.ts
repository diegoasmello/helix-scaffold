import { useState } from 'react'

export function usePersistedSidebar(userId: string | undefined) {
  const key = userId ? `sidebar:collapsed:${userId}` : null

  const [collapsed, setCollapsed] = useState(() => {
    if (!key) return false
    try {
      return localStorage.getItem(key) === 'true'
    } catch {
      return false
    }
  })

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      if (key) {
        try {
          localStorage.setItem(key, String(next))
        } catch {
          // localStorage unavailable (e.g. private browsing)
        }
      }
      return next
    })
  }

  return [collapsed, toggle] as const
}
