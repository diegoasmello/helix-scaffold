# registration module — backend

Thin module with two parts: a single `GET` endpoint that exposes the registration mode and configured social providers to the frontend (reads `config`, no table), and the self-registration hook wiring — what a self-registered user gets lives in the accounts module (`src/modules/accounts/`).

## Purpose

The frontend (login page, sign-up route guard) cannot read the backend config. This endpoint is the single source of truth: it tells the frontend whether self-registration is enabled, and which social OAuth providers are enabled, so it can show/hide the appropriate UI elements and allow or redirect away from `/sign-up`.

## Registration

Registered at the **root scope** in `app.ts` — outside the `authenticated` scope, no session required:

```ts
app.register(registrationRoutes, { config })
```

## Endpoint

### `GET /registration/status`

Returns `{ open: boolean, providers: string[] }`. No auth, no permissions.

| Field | Type | Description |
| --- | --- | --- |
| `open` | `boolean` | `true` when `config.registration.mode === 'open'` |
| `providers` | `string[]` | Social providers enabled in `config.auth.socialProviders`. Always `[]` when `open` is `false`. |

**`providers` values:** `"google"` | `"facebook"` | `"apple"` — only providers enabled in `config.auth.socialProviders` (their credentials are guaranteed by config validation at startup).

**Why `providers` is empty when closed:** returning a non-empty list in closed mode would leak which OAuth services are configured without giving users a way to act on it. The list comes from `getUsableSocialProviders(config)` (`src/lib/social-providers.ts`), which `GET /me/providers` uses too.

## Configuration

Controlled by `registration.mode` in `apps/api/src/app.config.ts`:

```ts
registration: {
  mode: 'closed', // 'open' | 'closed', default 'closed'
},
```

| Mode | Behaviour |
| --- | --- |
| `closed` | Only admins can create accounts (via `POST /users`). Default. |
| `open` | Anyone can self-register via email/password or social OAuth. |

Tests force `mode: 'open'` via `src/config/test-overrides.ts` so test helpers can create users via the sign-up endpoint, regardless of the product setting.

## Social providers

Providers are turned on in `apps/api/src/app.config.ts` (`auth.socialProviders.<name>.enabled: true`); their credentials live in `.env`. The API refuses to start when an enabled provider has no credentials. They are wired in `apps/api/src/auth.ts` as `socialProviders` inside `betterAuth()`, each one included **conditionally**:

```ts
const { google, facebook, apple } = config.auth.socialProviders
const disableSignUp = config.registration.mode !== 'open'

socialProviders: {
  ...(google.enabled && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, disableSignUp } }
    : {}),
  // facebook and apple follow the same pattern
}
```

**`disableSignUp: config.registration.mode !== 'open'`** — Better Auth enforces this during the OAuth callback. In closed mode, the OAuth flow can be initiated but account creation is blocked server-side. The `providers` field in the status response is also empty in closed mode, so the login page never shows the buttons.

**Closed mode is email/password only:** no social button on the login page, and no account linking on `/me/security` either — `GET /me/providers` returns `[]` in closed mode, so the "link another account" section is hidden. Accounts linked earlier (e.g. while the app was in open mode) are still listed.

**Important:** `socialProviders` in `betterAuth()` expects **raw options objects**, not the result of calling the provider helper functions (`google()`, `facebook()`, etc.). Those helpers are for standalone use.

**`getConfiguredSocialProviders(config)`** in `src/lib/social-providers.ts` derives the enabled list from `config.auth.socialProviders`, the same source `auth.ts` uses; `getUsableSocialProviders()` filters it by mode. See `apps/api/CLAUDE.md` → _Shared social provider utility_ for the steps to add a new provider.

## Sign-up guard (email/password)

The enforcement for email/password sign-up lives in `app.ts`, not here. When mode is `closed`, an `onRequest` hook blocks `POST /api/auth/sign-up/email`:

```ts
instance.addHook('onRequest', async (request, reply) => {
  if (
    request.method === 'POST' &&
    request.url.split('?')[0] === `${API_PREFIX}/auth/sign-up/email` &&
    config.registration.mode !== 'open'
  ) {
    return reply.status(403).send({ message: 'Registration is closed' })
  }
})
```

Social sign-up is guarded differently: `disableSignUp` on each provider in `auth.ts` (see above).

## Self-registration defaults (default role + trial)

What a self-registered user gets in open mode — the default role and, when `subscriptions.trial` is set, a trial — is decided by `applySelfRegistrationDefaults()` in the accounts module (`src/modules/accounts/account-provisioning.ts`), next to every other way an account is created. `auth.ts` calls it from Better Auth's `databaseHooks.user.create.after`, only for sign-ups that carry `ctx.request` (over HTTP); it does nothing in closed mode. See `src/modules/accounts/CLAUDE.md`.

## Frontend counterpart

- `GET /registration/status` is consumed by `loginRoute.loader` and `signUpRoute.loader` in `apps/web/src/modules/auth/routes/index.ts`.
- Both loaders parallelise it with `getBootstrapStatus()` via `Promise.all`.
- `signUpRoute.loader` redirects to `/login` if `open` is false.
- Login page shows "Create one" link and social buttons only when `registrationOpen` is true.
- Sign-up page shows social buttons whenever `providers.length > 0` (the page is only reachable when open, so no additional guard is needed in the component).
- Social buttons call `authClient.signIn.social({ provider, callbackURL: window.location.origin + '/' })`.

See `apps/web/src/modules/auth/CLAUDE.md` for the full frontend documentation.
