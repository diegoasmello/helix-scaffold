# Email

Transactional email infrastructure. Provides a provider-agnostic `EmailProvider` interface so the sending implementation can be swapped without touching business logic.

## Interface

```ts
interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<void>
}
```

`send` throws on delivery failure. Callers decide whether to propagate the error (email is critical — e.g. email change verification) or swallow it (email is best-effort — e.g. password change notification).

## Templates

Every value placed in an email's HTML goes through `escapeHtml()` (exported from `index.ts`) — including the links better-auth builds: the change-email link carries the caller's raw `callbackURL`, so an unescaped `"` would let anyone inject HTML into a message sent from the app's own address. Covered in `src/auth.test.ts` (`describe('email templates')`).

## Implementations

Both are private factory functions in `index.ts`; only `EmailProvider` (the interface), `createEmailProvider` and `escapeHtml` are exported.

| Implementation | When used |
|---|---|
| `createResendEmailProvider` | `NODE_ENV !== 'test'` and `RESEND_API_KEY` is set |
| `createConsoleEmailProvider` | `development` without `RESEND_API_KEY`, and all test runs |
| — (throws) | `NODE_ENV=production` without `RESEND_API_KEY`: `createEmailProvider` refuses, so `buildApp` (and the API) does not start |

The console provider logs the full HTML body to stdout including the verification URL — sufficient for local testing without any external account. That is exactly why production never falls back to it: the body carries live password-reset and verification links, and anyone reading the logs could take over the account. A production deploy must set `RESEND_API_KEY` — and `NODE_ENV=production`, since an unset `NODE_ENV` means `development` (`src/env.ts`).

The Resend provider uses Resend's REST API directly via `fetch` (no SDK dependency). On a non-2xx response it logs the raw body to stderr and throws a generic message, so Resend error details never leak to the caller or to error-monitoring payloads.

## Factory

```ts
// app.ts — `config` is the one buildApp() received
import { env } from '@/env'
import { createEmailProvider } from '@/lib/email'

const emailProvider = createEmailProvider({
  resendApiKey: env.RESEND_API_KEY,
  from: config.email.from,
  nodeEnv: env.NODE_ENV,
})
```

Called once in `app.ts`. The returned instance is injected into `createAuth` and into each route module that needs it via route options.

## Configuration

| Setting | Where | Default | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | `.env` | — | Required in production. Omit in development to fall back to console logging. |
| `email.from` | `src/app.config.ts` | `noreply@localhost` | Sender address. Must be from a domain verified in Resend for production. |

**Resend domain requirement**: Resend rejects sends from unverified domains (including `gmail.com` or any domain you don't own). For production, add and verify your domain at resend.com/domains. For local testing without a verified domain, omit `RESEND_API_KEY` and use the console provider.

## Using EmailProvider in a module

Inject `emailProvider` via route options — the same pattern as `storage`:

```ts
// app.ts
authenticated.register(featureRoutes, { database, requirePermission, emailProvider })

// feature-routes.ts
export async function featureRoutes(
  app: FastifyTypedInstance,
  { database, requirePermission, emailProvider }: { ..., emailProvider: EmailProvider }
) {
  const service = createFeatureService(database, emailProvider)
  ...
}
```

### Critical emails (errors must propagate)

When the email is the point of the request (e.g. email change verification), let `send` throw and catch it explicitly in the route:

```ts
// service
async function sendFoo(to: string, url: string) {
  await emailProvider.send(to, 'Subject', html)
}

// route
try {
  await service.sendFoo(email, url)
} catch (error) {
  if (error instanceof APIError) {
    return reply.status(400).send({ message: error.message })
  }
  return reply.status(500).send({ message: 'Failed to send email' })
}
```

### Best-effort emails (errors must not propagate)

When the email is a notification after an action that already succeeded (e.g. password change notification), fire-and-forget:

```ts
emailProvider.send(userEmail, 'Subject', html).catch(() => {})
```

Never use `.catch(() => {})` for verification or gating emails — silent failure would leave the user with no path forward.

## better-auth and the background task limitation

better-auth calls `emailVerification.sendVerificationEmail` inside `runBackgroundTask`. This means:

- **Errors are swallowed** — if `send` throws, better-auth logs "Failed to run background task" but returns 200 to the client. The frontend sees success even if the email was never sent.
- **The verification token IS created synchronously** in the `verification` DB table before the background task fires.

**Password reset is not awaited on purpose.** `emailAndPassword.sendResetPassword` in `src/auth.ts` starts `emailProvider.send(...)` and returns, logging a failure (`'Failed to send password reset email'`). better-auth calls it only for a registered email and waits for it before answering, so an awaited send — a Resend round trip — would make `POST /api/auth/request-password-reset` measurably slower for registered addresses, an unauthenticated way to tell which emails have an account. The client already got 200 when the send failed, so nothing changes for it. Keep any future change to that callback non-blocking. Covered in `src/auth.test.ts` (a provider whose send never settles).

**Current state**: the email change flow (`PATCH /me/email`, which also asks for the current password and notifies the current address — see `src/modules/me/CLAUDE.md`) accepts this limitation. `me-service.changeEmail` calls `auth.api.changeEmail` and relies on the background task. If delivery fails, the user never receives the link but the API returns 200.

**If you need delivery errors to propagate to the HTTP response**, the workaround is:
1. Configure `sendVerificationEmail` in `auth.ts` as a no-op (`async () => {}`)
2. After calling `auth.api.changeEmail`, query the `verification` table for the freshest token by `identifier = currentEmail`
3. Build the URL: `${BASE_URL}/api/auth/verify-email?token=${record.value}&callbackURL=...`
4. Call `emailProvider.send` yourself — errors now propagate normally

The token is always present in the DB before `auth.api.changeEmail` returns, so the query is safe.
