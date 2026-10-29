CREATE TYPE "public"."live_session_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'queued', 'playing', 'done', 'skipped', 'rejected');--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(12) NOT NULL,
	"name" varchar(120) NOT NULL,
	"status" "live_session_status" DEFAULT 'active' NOT NULL,
	"requests_open" boolean DEFAULT true NOT NULL,
	"now_playing_request_id" uuid,
	"created_by" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_status" "request_status",
	"to_status" "request_status" NOT NULL,
	"actor_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"nickname" varchar(40) NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"queue_position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "bpm" integer;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "genre" varchar(80);--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "audience_requestable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "display_username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_request_id_song_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."song_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_requests" ADD CONSTRAINT "song_requests_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_requests" ADD CONSTRAINT "song_requests_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "live_sessions_code_idx" ON "live_sessions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "live_sessions_status_idx" ON "live_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "request_history_request_idx" ON "request_status_history" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "song_requests_session_status_idx" ON "song_requests" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "song_requests_queue_idx" ON "song_requests" USING btree ("session_id","queue_position");--> statement-breakpoint
CREATE INDEX "chord_sources_song_idx" ON "chord_sources" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "songs_title_artist_idx" ON "songs" USING btree ("title","artist");--> statement-breakpoint
CREATE INDEX "songs_updated_idx" ON "songs" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");