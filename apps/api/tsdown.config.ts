import { defineConfig } from 'tsdown'

// `pnpm build` → dist/server.js, run by `pnpm start`. Dependencies stay
// external (installed in node_modules on the server); only src/ is bundled,
// with the `@/` alias and the PDF templates' JSX resolved from tsconfig.json.
export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  fixedExtension: false,
})
