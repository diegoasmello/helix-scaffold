# Glossary

Domain terms used across `apps/api` and `apps/web`. Use these names in code, docs and reviews. When a concept gets a sharper name, update it here.

## Subscriptions

| Term | Meaning |
| --- | --- |
| **Plan** | An entry of the catalog in `subscriptions.plans` (`apps/api/src/app.config.ts`): `{ id, name, features }`. Pricing lives in the payment processor, not here. |
| **Feature** | A free key a plan unlocks (usually a module name, e.g. `todos`). Checked by `requireSubscription('<feature>')` and, in the UI, by `hasSubscriptionAccess('<feature>')`. A feature no plan declares fails at API startup. |
| **Live subscription** | `status` is `active` or `trialing`. At most one per user (partial unique index `subscriptions_one_live_per_user`). This is what the billing sync cancels and the expiration job expires. |
| **Grace period** | The `subscriptions.pastDueGraceDays` days after `pastDueSince` during which a `past_due` subscription still grants access while the processor retries the payment. |
| **Access-granting subscription** | A live subscription, or a `past_due` one inside its grace period. Found by `getAccessGrantingByUserId()`. Not the same as "live": a past_due row grants access but is not live. |
| **Operator** | A user whose role has `subscriptions:view`. Never blocked by the subscription axis. |
| **Entitlements** | The single answer to "what does the subscription axis let this user do": `{ operator, subscribed, features, graceEndsAt }`. Decided in `apps/api/src/modules/subscriptions/entitlements.ts`, enforced by `requireSubscription()`, returned by `GET /me/entitlements`. The frontend only reads it. |
| **Entitlement denial** | Why access was refused: `subscription_required` (no access-granting subscription) or `feature_not_in_plan`. Sent as the `code` of the 403. |

## Access control

| Term | Meaning |
| --- | --- |
| **Permission** | A `resource:action` grant held by a role (RBAC, `apps/api/src/config/permissions.ts`). Independent of the subscription axis. A missing one answers 403 with `code: 'permission_denied'`. |
