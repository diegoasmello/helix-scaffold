-- Before enforcing one live subscription per user, cancel older duplicates
-- (keeps the most recent active/trialing row for each user).
UPDATE "subscriptions"
SET "status" = 'canceled', "canceled_at" = COALESCE("canceled_at", now())
WHERE "status" IN ('active', 'trialing')
  AND "id" NOT IN (
    SELECT DISTINCT ON ("user_id") "id"
    FROM "subscriptions"
    WHERE "status" IN ('active', 'trialing')
    ORDER BY "user_id", "created_at" DESC
  );--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_live_per_user" ON "subscriptions" USING btree ("user_id") WHERE status in ('active', 'trialing');