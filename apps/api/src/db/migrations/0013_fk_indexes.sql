CREATE INDEX "user_role_id_idx" ON "user" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "uploads_uploaded_by_idx" ON "uploads" USING btree ("uploaded_by");