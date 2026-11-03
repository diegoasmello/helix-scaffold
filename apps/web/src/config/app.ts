// ─────────────────────────────────────────────
// Frontend app config — product decisions that live in the web app.
//
// Behaviour settings (registration mode, social providers, subscriptions)
// come from the API at runtime — configure them in apps/api/src/app.config.ts,
// never here. The API URL is per-deploy and lives in `.env` (VITE_API_URL).
//
// Related files in `src/config/`:
//   - sidebar.ts  → navigation groups, items and their permissions
//   - theme.ts    → Mantine theme (colors, primary color, fonts)
// ─────────────────────────────────────────────

const languages = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
] as const

type LanguageCode = (typeof languages)[number]['value']

interface WebAppConfig {
  /**
   * Product name. The browser tab title: alone in `index.html`, after the
   * page title on each page (`Tasks | Helix` — `DocumentTitleProvider` in
   * `main.tsx`).
   */
  name: string
  i18n: {
    /**
     * Languages offered in the language picker. Each one needs a locale
     * folder in `src/i18n/locales/<value>/` registered in `src/i18n/index.ts`.
     */
    languages: typeof languages
    /** Used when the browser language is not supported, and as `<html lang>`. */
    defaultLanguage: LanguageCode
  }
}

export const appConfig: WebAppConfig = {
  name: 'Helix',
  i18n: {
    languages,
    defaultLanguage: 'en',
  },
}
