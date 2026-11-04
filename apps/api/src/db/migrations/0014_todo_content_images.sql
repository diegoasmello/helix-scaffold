CREATE TABLE "todo_content_images" (
	"todo_id" text NOT NULL,
	"upload_id" text NOT NULL,
	CONSTRAINT "todo_content_images_todo_id_upload_id_pk" PRIMARY KEY("todo_id","upload_id")
);
--> statement-breakpoint
ALTER TABLE "todo_content_images" ADD CONSTRAINT "todo_content_images_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_content_images" ADD CONSTRAINT "todo_content_images_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todo_content_images_upload_id_idx" ON "todo_content_images" USING btree ("upload_id");