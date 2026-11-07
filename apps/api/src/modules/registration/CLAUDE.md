# registration module — backend

Thin module with two parts: a single `GET` endpoint that exposes the registration mode and configured social providers to the frontend (reads `config`, no table), and the self-registration hook wiring — what a self-registered user gets lives in the accounts module (`src/modules/accounts/`).

## Purpose

The frontend (login page, sign-up route guard) cannot read the backend config. This endpoint is the single source of truth: it tells the frontend whether self-registration is enabled, and which social OAuth providers are enabled, so it can show/hide the appropriate UI elements and allow or redirect away from `/sign-up`.

## Registration

Registered in the `/api` scope of `app.ts` — outside the `authenticated` scope, no session required:

```ts
api.register(registrationRoutes, { config })
```

## Endpoint

### `GET /registration/status`

Returns `{ open: boolean, providers: string[], email: boolean }`. No auth, no permissions.

| Field | Type | Description |
| --- | --- | --- |
| `open` | `boolean` | `true` when `config.registration.mode === 'open'` |
| `providers` | `string[]` | Social providers enabled in `config.auth.socialProviders`. Always `[]` when `open` is `false`. |
| `email` | `boolean` | `config.email.enabled` — whether the API sends email. The web hides the password reset and the self-service email change without it (they open a "contact your administrator" modal); see the root `CLAUDE.md` → _Email_. Always `true` when `open` is `true` (open registration requires email) |

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

**No implicit linking:** `account.accountLinking.disableImplicitLinking: true` in `src/auth.ts`. A social sign-in whose email already belongs to an account fails with `account_not_linked` (better-auth redirects to the client's `errorCallbackURL`, `/login`) instead of joining it: email sign-ups are never verified, so an attacker who registered the victim's address first would otherwise keep a working password into the account the victim opens with Google (pre-account takeover). Linking happens only signed in, through `linkSocial` on `/me/security`, which this option does not affect. Asserted in `src/auth.test.ts` (`describe('account linking')`).

**Important:** `socialProviders` in `betterAuth()` expects **raw options objects**, not the result of calling the provider helper functions (`google()`, `facebook()`, etc.). Those helpers are for standalone use.

**`getConfiguredSocialProviders(config)`** in `src/lib/social-providers.ts` derives the enabled list from `config.auth.socialProviders`, the same source `auth.ts` uses; `getUsableSocialProviders()` filters it by mode. See `apps/api/CLAUDE.md` → _Shared social provider utility_ for the steps to add a new provider.

## Sign-up guard (email/password)

The enforcement for email/password sign-up lives in `auth.ts`, not here. When mode is `closed`, a Better Auth `hooks.before` middleware answers 403 `{ message: 'Registration is closed' }` to the sign-up endpoint when it is reached over HTTP:

```ts
hooks: {
  before: createAuthMiddleware(async (ctx) => {
    if (disableSignUp && ctx.path === '/sign-up/email' && ctx.request) {
      throw new APIError('FORBIDDEN', { message: 'Registration is closed' })
    }
  }),
},
```

`ctx.path` is the path of the endpoint Better Auth routed the request to, not the request URL. Never guard sign-up by matching `request.url` in Fastify: Better Auth routes on the URL after it has been resolved (`/./`, `%2e`, `..` segments, absolute-form targets), so a spelling the string match does not expect still reaches the endpoint. `emailAndPassword.disableSignUp` is not an option either: Better Auth applies it to server calls too, which would block account provisioning. Server-side sign-ups (`auth.api.signUpEmail()` from `POST /users`, bootstrap, the seed) carry no `ctx.request`, so they pass.

Social sign-up is guarded differently: `disableSignUp` on each provider in `auth.ts` (see above).

## Self-registration defaults (default role + trial)

What a self-registered user gets in open mode — the default role and, when `subscriptions.trial` is set, a trial — is decided by `applySelfRegistrationDefaults()` in the accounts module (`src/modules/accounts/account-provisioning.ts`), next to every other way an account is created. `auth.ts` calls it from Better Auth's `databaseHooks.user.create.after`, only for sign-ups that carry `ctx.request` (over HTTP); it does nothing in closed mode. See `src/modules/accounts/CLAUDE.md`.

## Frontend counterpart

- `GET /registration/status` is consumed by `loginRoute.loader`, `signUpRoute.loader` and `forgotPasswordRoute.loader` in `apps/web/src/modules/auth/routes/index.ts`, and by `meRoute.loader` (`registrationStatusQueryOptions()`, read by `useEmailEnabled()` on `/me/account`).
- Both loaders parallelise it with `getBootstrapStatus()` via `Promise.all`.
- `signUpRoute.loader` redirects to `/login` if `open` is false.
- Login page shows "Create one" link and social buttons only when `registrationOpen` is true.
- Sign-up page shows social buttons whenever `providers.length > 0` (the page is only reachable when open, so no additional guard is needed in the component).
- Social buttons call `authClient.signIn.social({ provider, callbackURL: window.location.origin + '/' })`.

See `apps/web/src/modules/auth/CLAUDE.md` for the full frontend documentation.
