CREATE INDEX "todo_attachments_upload_id_idx" ON "todo_attachments" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "todos_file_id_idx" ON "todos" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "todos_image_id_idx" ON "todos" USING btree ("image_id");