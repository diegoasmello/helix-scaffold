import { createContext, useContext } from 'react'

interface SidebarPreferenceContextValue {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const SidebarPreferenceContext =
  createContext<SidebarPreferenceContextValue | null>(null)

export function useSidebarPreference(): SidebarPreferenceContextValue {
  const ctx = useContext(SidebarPreferenceContext)
  if (!ctx) throw new Error('useSidebarPreference must be used within App')
  return ctx
}
