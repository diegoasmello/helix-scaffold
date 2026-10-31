import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { appConfig } from './src/config/app'

// Injects the product name and default language from src/config/app.ts
// into index.html, so they are correct before any JS runs.
function appConfigHtml(): Plugin {
  return {
    name: 'app-config-html',
    transformIndexHtml: (html) =>
      html
        .replace('%APP_NAME%', appConfig.name)
        .replace('%APP_LANG%', appConfig.i18n.defaultLanguage),
  }
}

export default defineConfig({
  plugins: [react(), appConfigHtml()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
