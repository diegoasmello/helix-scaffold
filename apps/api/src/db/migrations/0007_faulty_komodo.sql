ALTER TABLE "subscriptions" ADD COLUMN "past_due_since" timestamp;--> statement-breakpoint
-- Existing past_due rows start their grace period at their last update.
UPDATE "subscriptions" SET "past_due_since" = "updated_at" WHERE "status" = 'past_due';
