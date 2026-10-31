import { defineConfig } from '@kubb/core'
import { pluginFaker } from '@kubb/plugin-faker'
import { pluginMsw } from '@kubb/plugin-msw'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginTs } from '@kubb/plugin-ts'

const excludeAuth = [{ type: 'path' as const, pattern: /^\/api\/auth/ }]

export default defineConfig({
  input: {
    // KUBB_INPUT=./openapi.json generates from the committed spec instead of
    // the running API (whose spec depends on its local app.config.ts).
    path: process.env.KUBB_INPUT ?? 'http://localhost:3333/docs/openapi.json',
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
      baseURL: 'http://localhost:3333',
    }),
  ],
})
