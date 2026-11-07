import { defineConfig } from 'tsdown'

// `pnpm build` → dist/server.js (`pnpm start`), dist/migrate.js
// (`pnpm migrate`) and dist/reset-admin-password.js (`pnpm
// reset-admin-password <email>`), plus the SQL migrations copied to
// dist/migrations.
// Dependencies stay external (installed in node_modules on the server); only
// src/ is bundled, with the `@/` alias and the PDF templates' JSX resolved
// from tsconfig.json.
export default defineConfig({
  entry: {
    server: 'src/server.ts',
    migrate: 'src/db/migrate.ts',
    'reset-admin-password': 'src/scripts/reset-admin-password.ts',
  },
  // Copies the folder itself, so it lands as dist/migrations
  copy: [{ from: 'src/db/migrations', to: 'dist' }],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  fixedExtension: false,
})
