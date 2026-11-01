# accounts module — account provisioning

Every way a user comes into existence lives here (`account-provisioning.ts`), together with what each kind of account gets. No routes and no table of its own: the callers are thin.

| Kind | Function | Caller | Role | Trial |
| --- | --- | --- | --- | --- |
| first admin | `provisionFirstAdmin()` | `POST /bootstrap` | `Admin`, every permission (+ the default role in open mode) | no |
| admin-created | `provisionAccount()` | `POST /users` (`users-service.create`) | the `roleId` sent, or none | no |
| seeded | `provisionAccount()` + `ensureDefaultRole()` | `src/db/seed.ts` | the one the seed picks | no |
| self-registered | `applySelfRegistrationDefaults()` | better-auth `user.create.after` hook (`src/auth.ts`) | the default role | when `subscriptions.trial` is set |

**Never create a user anywhere else** — not with `auth.api.signUpEmail()` and not with an insert into `user`. A new way to create accounts is a new function here.

## Why one module

better-auth writes the user row through its own connection, so it can never join a transaction. Each kind therefore creates the user first and **deletes it again** (sessions and accounts cascade) when the rest fails — no half-provisioned account (a user without its role) is left behind. Keeping every kind here keeps that compensation, the role rules and the trial rule in one place.

## Interface

```ts
createAccountProvisioning(database, auth, config) → {
  isBootstrapped(): Promise<boolean>
  provisionFirstAdmin({ name, email, password }): Promise<{ status: 'created', userId } | { status: 'already_bootstrapped' }>
  provisionAccount({ name, email, password, roleId? }): Promise<string>   // the user id; throws RoleNotFoundError
}

ensureDefaultRole(databaseOrTx, config)                               // open mode only
applySelfRegistrationDefaults(database, userId, config, logger)       // open mode only
```

- **`provisionFirstAdmin`** — `409`-style `already_bootstrapped` when any user exists, or when a concurrent bootstrap won. In one transaction: `pg_advisory_xact_lock(hashtext('helix:bootstrap'))`; backs out if another user already has a role (the winner — both users may exist by then, since better-auth created them outside the lock); upserts the `Admin` role by name (a leftover one is reused, stops being the default and gets the full catalog); replaces its permissions with `ALL_PERMISSIONS`; assigns it; `ensureDefaultRole()`.
- **`provisionAccount`** — checks the role first (`RoleNotFoundError` — a `DomainError`, 404 `role_not_found` — before anything is written); a used email is `EmailTakenError` (409 `email_taken`, mapped from better-auth's `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`); after sign-up a failed assignment deletes the user (a role deleted in between is reported as `RoleNotFoundError` too).
- **`ensureDefaultRole`** — in open mode, a role already marked `isDefault` is kept; otherwise `User` becomes the default: created with no permissions, or promoted with its permissions if a role by that name exists. Used by bootstrap and the seed. No-op in closed mode.
- **`applySelfRegistrationDefaults`** — open mode only: assigns the default role (logs a **warning** when none is marked default — the sign-up still succeeds, but the user can only open `/me`), then, when `subscriptions.enabled` and `subscriptions.trial` are set, inserts a trialing subscription. The trial is best-effort: a failed insert is logged (`'Trial subscription creation failed'`, with `userId`) and does not fail the sign-up.

## Self-registered vs. server-created

The better-auth hook in `src/auth.ts` runs for every user better-auth creates. It calls `applySelfRegistrationDefaults()` only when `ctx.request` is set — sign-ups that arrive over HTTP (`POST /api/auth/sign-up/email`, social callbacks). `auth.api.signUpEmail()` called by this module carries no request, so server-created accounts get exactly the role their kind gives and never a trial. Verified empirically: better-auth passes a context without `request`/`headers` to server-side calls.

## Tests (`account-provisioning.test.ts`)

Real test database; `createAuth(testDb, …)` for the provisioning under test.

- self-registered over HTTP gets the default role; `POST /users` without `roleId` gets `null` and no subscription
- `applySelfRegistrationDefaults` — trial created (14 days, default role), failed trial logged, no trial when off, warning without a default role, nothing in closed mode
- `ensureDefaultRole` — creates an empty `User`, promotes an existing `User` with its permissions, keeps an existing default, nothing in closed mode
- `provisionAccount` — with a role, without one (never the default), unknown role rejected before any write, failed assignment leaves no user (`Object.create(testDb)` with a throwing `update`)

`provisionFirstAdmin` is covered through `POST /bootstrap` in `bootstrap-routes.test.ts` (atomicity, leftover roles, the race, closed mode).
