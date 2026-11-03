ALTER TABLE "todos" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "todos_slug_unique" ON "todos" USING btree ("slug" text_pattern_ops);