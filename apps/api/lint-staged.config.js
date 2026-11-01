import { fileURLToPath } from 'node:url'

// Absolute: lint-staged runs tasks from the repository root, not from here.
const API_DIR = fileURLToPath(new URL('.', import.meta.url))
const SPEC = fileURLToPath(
  new URL('../../packages/api-client/openapi.json', import.meta.url)
)

export default {
  '**/*.{ts,js}': 'eslint --fix',
  // Any source change may touch a route, so the committed spec is re-exported
  // and staged with it (src/scripts/export-spec.ts — no server or DB needed).
  // A function, so the staged file names are not appended to the commands.
  'src/**/!(*.test).ts': () => [
    `pnpm --dir "${API_DIR}" spec:export "${SPEC}"`,
    `git add "${SPEC}"`,
  ],
}
