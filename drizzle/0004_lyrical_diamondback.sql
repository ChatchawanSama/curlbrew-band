ALTER TABLE "session_queue_items" ADD COLUMN "entry_artist" varchar(160);--> statement-breakpoint
ALTER TABLE "session_queue_items" ADD COLUMN "entry_key" varchar(12);--> statement-breakpoint
ALTER TABLE "session_queue_items" ADD COLUMN "entry_note" text;--> statement-breakpoint
ALTER TABLE "session_queue_items" ADD COLUMN "entry_chord_url" text;--> statement-breakpoint
ALTER TABLE "session_requests" ADD COLUMN "requested_key" varchar(12);--> statement-breakpoint
ALTER TABLE "session_requests" ADD COLUMN "requested_note" text;--> statement-breakpoint
ALTER TABLE "session_requests" ADD COLUMN "requested_chord_url" text;