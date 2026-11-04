ALTER TABLE "roles" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_is_admin_unique" ON "roles" USING btree ("is_admin") WHERE is_admin = true;