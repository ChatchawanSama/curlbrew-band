CREATE TYPE "public"."session_queue_status" AS ENUM('queued', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."session_request_status" AS ENUM('pending', 'added', 'dismissed');--> statement-breakpoint
CREATE TABLE "session_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"status" "session_queue_status" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"song_id" uuid,
	"requested_title" varchar(160) NOT NULL,
	"requested_artist" varchar(160),
	"nickname" varchar(40),
	"status" "session_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chord_sources" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "live_sessions" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "management_secret_hash" text;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "session_queue_items" ADD CONSTRAINT "session_queue_items_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_queue_items" ADD CONSTRAINT "session_queue_items_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_requests" ADD CONSTRAINT "session_requests_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_requests" ADD CONSTRAINT "session_requests_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_queue_session_position_idx" ON "session_queue_items" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "session_queue_session_status_idx" ON "session_queue_items" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "session_requests_session_status_idx" ON "session_requests" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "session_requests_created_idx" ON "session_requests" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "live_sessions_scheduled_idx" ON "live_sessions" USING btree ("scheduled_at");