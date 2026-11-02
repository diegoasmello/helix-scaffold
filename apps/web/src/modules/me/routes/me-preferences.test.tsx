import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../../i18n'
import { SidebarPreferenceContext } from '../../../lib/sidebar-preference'
import { MePreferences } from './me-preferences'

function renderMePreferences(sidebarCollapsed = false) {
  const toggleSidebar = vi.fn()
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <SidebarPreferenceContext.Provider
          value={{ sidebarCollapsed, toggleSidebar }}
        >
          <MePreferences />
        </SidebarPreferenceContext.Provider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
  return { toggleSidebar }
}

afterEach(async () => {
  // Language and color scheme are global — restore them for the next test.
  await i18n.changeLanguage('en')
  localStorage.clear()
  document.documentElement.removeAttribute('data-mantine-color-scheme')
})

describe('MePreferences', () => {
  it('renders the three sections', () => {
    renderMePreferences()
    expect(
      screen.getByRole('heading', { name: 'Language' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Appearance' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Navigation' })
    ).toBeInTheDocument()
  })

  describe('language', () => {
    it('shows the current language', () => {
      renderMePreferences()
      expect(screen.getByRole('combobox')).toHaveValue('English')
    })

    it('offers the languages from the app config', async () => {
      renderMePreferences()
      await userEvent.click(screen.getByRole('combobox'))
      expect(
        screen.getByRole('option', { name: 'English', hidden: true })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('option', {
          name: 'Português (Brasil)',
          hidden: true,
        })
      ).toBeInTheDocument()
    })

    it('switches the app language when another one is picked', async () => {
      renderMePreferences()
      await userEvent.click(screen.getByRole('combobox'))
      await userEvent.click(
        screen.getByRole('option', { name: 'Português (Brasil)', hidden: true })
      )
      await waitFor(() => expect(i18n.language).toBe('pt-BR'))
      // The screen re-renders in the new language.
      expect(
        await screen.findByRole('heading', { name: 'Idioma' })
      ).toBeInTheDocument()
    })
  })

  describe('dark mode', () => {
    it('is off with the default light scheme', () => {
      renderMePreferences()
      expect(
        screen.getByRole('switch', { name: 'Dark mode' })
      ).not.toBeChecked()
    })

    it('switches the color scheme to dark and back', async () => {
      renderMePreferences()
      const toggle = screen.getByRole('switch', { name: 'Dark mode' })

      await userEvent.click(toggle)
      expect(toggle).toBeChecked()
      expect(document.documentElement).toHaveAttribute(
        'data-mantine-color-scheme',
        'dark'
      )

      await userEvent.click(toggle)
      expect(toggle).not.toBeChecked()
      expect(document.documentElement).toHaveAttribute(
        'data-mantine-color-scheme',
        'light'
      )
    })
  })

  describe('hide sidebar', () => {
    it('reflects the current sidebar preference', () => {
      renderMePreferences(true)
      expect(
        screen.getByRole('switch', { name: 'Hide left navigation' })
      ).toBeChecked()
    })

    it('calls toggleSidebar when clicked', async () => {
      const { toggleSidebar } = renderMePreferences()
      await userEvent.click(
        screen.getByRole('switch', { name: 'Hide left navigation' })
      )
      expect(toggleSidebar).toHaveBeenCalledTimes(1)
    })
  })

  it('throws when rendered outside the sidebar preference context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <MantineProvider>
          <MantineEmotionProvider>
            <MePreferences />
          </MantineEmotionProvider>
        </MantineProvider>
      )
    ).toThrow('useSidebarPreference must be used within App')
  })
})
