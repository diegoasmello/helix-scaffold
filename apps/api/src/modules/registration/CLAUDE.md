# registration module — backend

Thin, stateless module that exposes the current registration mode and configured social providers to the frontend. Has no database table, no service, and no mutations — only a single `GET` endpoint that reads from `env`.

## Purpose

The frontend (login page, sign-up route guard) cannot read backend env vars directly. This endpoint is the single source of truth: it tells the frontend whether self-registration is enabled, and which social OAuth providers have credentials configured, so it can show/hide the appropriate UI elements and allow or redirect away from `/sign-up`.

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
| `open` | `boolean` | `true` when `REGISTRATION_MODE === 'open'` |
| `providers` | `string[]` | Social providers with credentials configured. Always `[]` when `open` is `false`. |

**`providers` values:** `"google"` | `"facebook"` | `"apple"` — only providers whose `CLIENT_ID` and `CLIENT_SECRET` env vars are both set.

**Why `providers` is empty when closed:** returning a non-empty list in closed mode would leak which OAuth services are configured without giving users a way to act on it. The list is filtered to only the effective state: `env.REGISTRATION_MODE === 'open' ? getConfiguredProviders() : []`.

## Configuration

Controlled by `REGISTRATION_MODE` in `apps/api/src/env.ts`:

```
REGISTRATION_MODE: z.enum(['open', 'closed']).default('closed')
```

| Mode | Behaviour |
| --- | --- |
| `closed` | Only admins can create accounts (via `POST /users`). Default. |
| `open` | Anyone can self-register via email/password or social OAuth. |

Set in `.env` (or via environment at deploy time). The test env (`.env.test`) uses `REGISTRATION_MODE=open` so test helpers can create users via the sign-up endpoint.

## Social providers

Social providers are configured in `apps/api/src/auth.ts` as `socialProviders` inside `betterAuth()`. Each provider is included **conditionally** — only when both its `CLIENT_ID` and `CLIENT_SECRET` env vars are set:

```ts
socialProviders: {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, disableSignUp: env.REGISTRATION_MODE !== 'open' } }
    : {}),
  // facebook and apple follow the same pattern
}
```

**`disableSignUp: env.REGISTRATION_MODE !== 'open'`** — Better Auth enforces this during the OAuth callback. In closed mode, the OAuth flow can be initiated but account creation is blocked server-side. The `providers` field in the status response is also empty in closed mode, so the frontend never shows the buttons.

**Important:** `socialProviders` in `betterAuth()` expects **raw options objects**, not the result of calling the provider helper functions (`google()`, `facebook()`, etc.). Those helpers are for standalone use.

**`getConfiguredProviders()`** in `registration-routes.ts` reads the same env vars as `auth.ts` to determine which providers are active. If you add a new social provider to `auth.ts`, add it to `getConfiguredProviders()` as well — they must stay in sync.

## Sign-up guard (email/password)

The enforcement for email/password sign-up lives in `app.ts`, not here. When mode is `closed`, an `onRequest` hook blocks `POST /api/auth/sign-up/email`:

```ts
instance.addHook('onRequest', async (request, reply) => {
  if (
    request.method === 'POST' &&
    request.url.split('?')[0] === '/api/auth/sign-up/email' &&
    env.REGISTRATION_MODE !== 'open'
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
        if (env.REGISTRATION_MODE !== 'open') return
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
