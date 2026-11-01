# registration module — backend

Thin, stateless module that exposes the current registration mode and configured social providers to the frontend. Has no database table, no service, and no mutations — only a single `GET` endpoint that reads from `config` (`src/app.config.ts`).

## Purpose

The frontend (login page, sign-up route guard) cannot read the backend config. This endpoint is the single source of truth: it tells the frontend whether self-registration is enabled, and which social OAuth providers are enabled, so it can show/hide the appropriate UI elements and allow or redirect away from `/sign-up`.

## Registration

Registered at the **root scope** in `app.ts` — outside the `authenticated` scope, no session required:

```ts
app.register(registrationRoutes)
```

## Endpoint

### `GET /registration/status`

Returns `{ open: boolean, providers: string[] }`. No auth, no permissions.

| Field | Type | Description |
| --- | --- | --- |
| `open` | `boolean` | `true` when `config.registration.mode === 'open'` |
| `providers` | `string[]` | Social providers enabled in `config.auth.socialProviders`. Always `[]` when `open` is `false`. |

**`providers` values:** `"google"` | `"facebook"` | `"apple"` — only providers enabled in `config.auth.socialProviders` (their credentials are guaranteed by config validation at startup).

**Why `providers` is empty when closed:** returning a non-empty list in closed mode would leak which OAuth services are configured without giving users a way to act on it. The list is filtered to only the effective state: `config.registration.mode === 'open' ? getConfiguredSocialProviders() : []`.

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

**Consequence in closed mode:** users can still *link* an enabled provider from `/me/security` (that list comes from `GET /me/providers`, which ignores the mode), but the login page offers no social button to sign in with it afterwards. Closed mode is effectively email/password only.

**Important:** `socialProviders` in `betterAuth()` expects **raw options objects**, not the result of calling the provider helper functions (`google()`, `facebook()`, etc.). Those helpers are for standalone use.

**`getConfiguredSocialProviders()`** in `src/lib/social-providers.ts` derives the active list from `config.auth.socialProviders`, the same source `auth.ts` uses. See `apps/api/CLAUDE.md` → _Shared social provider utility_ for the steps to add a new provider.

## Sign-up guard (email/password)

The enforcement for email/password sign-up lives in `app.ts`, not here. When mode is `closed`, an `onRequest` hook blocks `POST /api/auth/sign-up/email`:

```ts
instance.addHook('onRequest', async (request, reply) => {
  if (
    request.method === 'POST' &&
    request.url.split('?')[0] === '/api/auth/sign-up/email' &&
    config.registration.mode !== 'open'
  ) {
    return reply.status(403).send({ message: 'Registration is closed' })
  }
})
```

Social sign-up is guarded differently: `disableSignUp` on each provider in `auth.ts` (see above).

## Auto-assign role on sign-up

When mode is `open`, `auth.ts` uses Better Auth's `databaseHooks.user.create.after` to assign the default role to every new user — **this fires for both email/password and social sign-ups**, since both go through the same user creation path:

```ts
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        if (config.registration.mode !== 'open') return
        const [defaultRole] = await database.select().from(roles)
          .where(eq(roles.isDefault, true)).limit(1)
        if (defaultRole) {
          await database.update(userTable)
            .set({ roleId: defaultRole.id })
            .where(eq(userTable.id, user.id))
        }
      },
    },
  },
},
```

**Why the hook is safe during bootstrap:** bootstrap creates the User role (with `isDefault = true`) *after* `auth.api.signUpEmail()`. When the hook fires for the admin user, the User role doesn't exist yet → the SELECT returns nothing → the admin is not assigned the User role. Bootstrap then explicitly assigns the Admin role.

## Frontend counterpart

- `GET /registration/status` is consumed by `loginRoute.loader` and `signUpRoute.loader` in `apps/web/src/modules/auth/routes/index.ts`.
- Both loaders parallelise it with `getBootstrapStatus()` via `Promise.all`.
- `signUpRoute.loader` redirects to `/login` if `open` is false.
- Login page shows "Create one" link and social buttons only when `registrationOpen` is true.
- Sign-up page shows social buttons whenever `providers.length > 0` (the page is only reachable when open, so no additional guard is needed in the component).
- Social buttons call `authClient.signIn.social({ provider, callbackURL: window.location.origin + '/' })`.

See `apps/web/src/modules/auth/CLAUDE.md` for the full frontend documentation.
