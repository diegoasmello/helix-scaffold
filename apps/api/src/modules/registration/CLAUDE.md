# registration module — backend

Thin, stateless module that exposes the current registration mode to the frontend. Has no database table, no service, and no mutations — only a single `GET` endpoint that reads from `env`.

## Purpose

The frontend (login page, sign-up route guard) cannot read backend env vars directly. This endpoint is the single source of truth: it tells the frontend whether self-registration is enabled so it can show/hide the "Create account" link and allow or redirect away from `/sign-up`.

## Registration

Registered at the **root scope** in `app.ts` — outside the `authenticated` scope, no session required:

```ts
app.register(registrationRoutes)
```

## Endpoint

### `GET /registration/status`

Returns `{ open: boolean }`. `open` is `true` when `env.REGISTRATION_MODE === 'open'`, `false` otherwise. No auth, no permissions.

## Configuration

Controlled by `REGISTRATION_MODE` in `apps/api/src/env.ts`:

```
REGISTRATION_MODE: z.enum(['open', 'closed']).default('closed')
```

| Mode     | Behaviour                                                                  |
| -------- | -------------------------------------------------------------------------- |
| `closed` | Only admins can create accounts (via `POST /users`). Default.              |
| `open`   | Anyone can self-register via `POST /api/auth/sign-up/email`.               |

Set in `.env` (or via environment at deploy time). The test env (`.env.test`) uses `REGISTRATION_MODE=open` so test helpers can create users via the sign-up endpoint.

## Sign-up guard

The actual enforcement lives in `app.ts`, not here. When mode is `closed`, an `onRequest` hook blocks `POST /api/auth/sign-up/email`:

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

The URL is split on `?` to strip query strings before matching (prevents bypass via e.g. `?foo=bar`).

## Auto-assign on sign-up

When mode is `open`, `auth.ts` uses better-auth's `databaseHooks.user.create.after` to assign the default role to every new user:

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

The guard (`REGISTRATION_MODE !== 'open'`) prevents a wasted DB query on every user creation in closed-mode deployments.

**Why the hook is safe during bootstrap:** bootstrap creates the User role (with `isDefault = true`) *after* `auth.api.signUpEmail()`. When the hook fires for the admin user, the User role doesn't exist yet → the SELECT returns nothing → the admin is not assigned the User role. Bootstrap then explicitly assigns the Admin role.

## Frontend counterpart

- `GET /registration/status` is consumed by `loginRoute.loader` and `signUpRoute.loader` in `apps/web/src/modules/auth/routes/index.ts`.
- `loginRoute.loader` parallelises it with `getBootstrapStatus()` via `Promise.all`.
- `signUpRoute.loader` redirects to `/login` if `open` is false.
- Login page shows "Create one" link only when `registrationOpen` from loader data is true.
