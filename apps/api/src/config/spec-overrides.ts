import type { AppConfig } from './define-config'

// Applied on top of `src/app.config.ts` by `src/scripts/export-spec.ts`, which
// writes the `openapi.json` that `@helix/api-client` is generated from.
//
// That spec is the contract of the codebase, not of one deploy: it must list
// every route the API can expose, whatever the product enables. The frontend
// compiles against all of them and decides at runtime what to show
// (`GET /subscription/status`). The spec a deploy serves at `/docs` still
// reflects its own config.
//
// Only settings that decide which routes exist belong here, plus what lets the
// app build without the product's secrets.
export const specConfigOverrides: AppConfig = {
  // Registers the subscription routes. The plan catalog never reaches the
  // spec (`planId` is a plain string), so a placeholder plan is enough;
  // `requireSubscription()` skips its feature check in this profile.
  subscriptions: {
    enabled: true,
    plans: [{ id: 'spec', name: 'Spec', features: [] }],
    trial: false,
  },
  // Their routes belong to better-auth (`/api/auth/*`, excluded from the
  // client). Off, so the export needs no OAuth credentials.
  auth: {
    socialProviders: {
      google: { enabled: false },
      facebook: { enabled: false },
      apple: { enabled: false },
    },
  },
  logger: { level: 'silent', pretty: false },
}

let specExport = false

/**
 * Makes `src/config/index.ts` apply `specConfigOverrides`. Must run before
 * anything imports `@/config`, which resolves once, on first import.
 */
export function enableSpecExport() {
  specExport = true
}

export function isSpecExport() {
  return specExport
}
