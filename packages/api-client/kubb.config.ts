import { defineConfig } from '@kubb/core'
import { pluginFaker } from '@kubb/plugin-faker'
import { pluginMsw } from '@kubb/plugin-msw'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginTs } from '@kubb/plugin-ts'

// Paths are relative to the spec's server (`/api`): better-auth is `/auth/*`.
const excludeAuth = [{ type: 'path' as const, pattern: /^\/auth\// }]

export default defineConfig({
  input: {
    // Always the committed contract (`pnpm export-spec`), never the running
    // API: its `/docs` spec drops every route its local app.config.ts turns
    // off, and the web imports those hooks statically.
    path: './openapi.json',
  },
  output: {
    path: './src/generated',
    clean: true,
    format: 'prettier',
    lint: 'eslint',
  },
  plugins: [
    pluginOas(),
    pluginTs({
      output: { path: 'types', barrelType: 'named' },
      exclude: excludeAuth,
    }),
    pluginReactQuery({
      output: { path: 'hooks', barrelType: 'named' },
      client: { importPath: '../../client' },
      exclude: excludeAuth,
    }),
    pluginFaker({
      output: { path: 'mocks', barrelType: 'named' },
      exclude: excludeAuth,
    }),
    pluginMsw({
      output: { path: 'mocks', barrelType: 'named' },
      exclude: excludeAuth,
      // The test VITE_API_URL + the spec's server (`/api`)
      baseURL: 'http://localhost:3333/api',
    }),
  ],
})
