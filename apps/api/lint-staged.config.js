import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Absolute: lint-staged does not run tasks from this directory.
const API_DIR = fileURLToPath(new URL('.', import.meta.url))
const SRC_DIR = path.join(API_DIR, 'src') + path.sep
const SPEC = fileURLToPath(
  new URL('../../packages/api-client/openapi.json', import.meta.url)
)

const quote = (file) => `"${file}"`

// A function (not a glob map) so the commands run in order: the spec export
// reads the sources, so it must start after Prettier has finished rewriting
// them — glob entries would run concurrently.
export default (stagedFiles) => {
  const code = stagedFiles.filter((file) => /\.(tsx?|js)$/.test(file))
  if (code.length === 0) return []

  const files = code.map(quote).join(' ')
  const commands = [`eslint --fix ${files}`, `prettier --write ${files}`]

  // Any source change may touch a route, so the committed spec is re-exported
  // and staged with it (src/scripts/export-spec.ts — no server or DB needed).
  const touchesSource = code.some(
    (file) => file.startsWith(SRC_DIR) && !/\.test\.tsx?$/.test(file)
  )
  if (touchesSource) {
    commands.push(
      `pnpm --dir "${API_DIR}" spec:export "${SPEC}"`,
      `git add "${SPEC}"`
    )
  }

  return commands
}
