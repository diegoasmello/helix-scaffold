import { loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    fileParallelism: false,
    // NODE_ENV is pinned so `.env` values never leak a non-test mode into
    // the suite — config test overrides depend on it.
    env: { ...loadEnv(mode, process.cwd(), ''), NODE_ENV: 'test' },
  },
}))
