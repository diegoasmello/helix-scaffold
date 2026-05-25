ALTER TABLE "todos" ADD COLUMN "file_id" text;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "image_id" text;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_file_id_uploads_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_image_id_uploads_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;