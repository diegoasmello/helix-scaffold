CREATE TYPE "public"."todo_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"user_email" text NOT NULL,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"role_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" text NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"canceled_at" timestamp with time zone,
	"past_due_since" timestamp with time zone,
	"external_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_attachments" (
	"todo_id" text NOT NULL,
	"upload_id" text NOT NULL,
	CONSTRAINT "todo_attachments_todo_id_upload_id_pk" PRIMARY KEY("todo_id","upload_id")
);
--> statement-breakpoint
CREATE TABLE "todo_content_images" (
	"todo_id" text NOT NULL,
	"upload_id" text NOT NULL,
	CONSTRAINT "todo_content_images_todo_id_upload_id_pk" PRIMARY KEY("todo_id","upload_id")
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"normalized_title" text NOT NULL,
	"normalized_description" text NOT NULL,
	"content" text NOT NULL,
	"status" "todo_status" DEFAULT 'pending' NOT NULL,
	"date" date NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"file_id" text,
	"image_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "todos_published_at_check" CHECK (not "todos"."published" or "todos"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"variants" jsonb DEFAULT 'null'::jsonb,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_attachments" ADD CONSTRAINT "todo_attachments_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_attachments" ADD CONSTRAINT "todo_attachments_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_content_images" ADD CONSTRAINT "todo_content_images_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_content_images" ADD CONSTRAINT "todo_content_images_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_file_id_uploads_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_image_id_uploads_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_id_idx" ON "user" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_unique" ON "role_permissions" USING btree ("role_id","resource","action");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_is_default_unique" ON "roles" USING btree ("is_default") WHERE is_default = true;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_is_admin_unique" ON "roles" USING btree ("is_admin") WHERE is_admin = true;--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_live_per_user" ON "subscriptions" USING btree ("user_id") WHERE status in ('active', 'trialing');--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_external_id_unique" ON "subscriptions" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "todo_attachments_upload_id_idx" ON "todo_attachments" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "todo_content_images_upload_id_idx" ON "todo_content_images" USING btree ("upload_id");--> statement-breakpoint
CREATE UNIQUE INDEX "todos_slug_unique" ON "todos" USING btree ("slug" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "todos_file_id_idx" ON "todos" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "todos_image_id_idx" ON "todos" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "todos_published_at_idx" ON "todos" USING btree ("published_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE "todos"."published";--> statement-breakpoint
CREATE INDEX "uploads_uploaded_by_idx" ON "uploads" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "uploads_storage_key_idx" ON "uploads" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "uploads_variant_thumbnail_key_idx" ON "uploads" USING btree (("variants" -> 'thumbnail' ->> 'key'));--> statement-breakpoint
CREATE INDEX "uploads_variant_small_key_idx" ON "uploads" USING btree (("variants" -> 'small' ->> 'key'));--> statement-breakpoint
CREATE INDEX "uploads_variant_medium_key_idx" ON "uploads" USING btree (("variants" -> 'medium' ->> 'key'));--> statement-breakpoint
CREATE INDEX "uploads_variant_large_key_idx" ON "uploads" USING btree (("variants" -> 'large' ->> 'key'));