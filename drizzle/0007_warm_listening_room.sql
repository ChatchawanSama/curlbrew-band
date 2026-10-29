ALTER TYPE "public"."live_session_status" RENAME VALUE 'active' TO 'scheduled';--> statement-breakpoint
ALTER TYPE "public"."live_session_status" RENAME VALUE 'ended' TO 'completed';--> statement-breakpoint
ALTER TYPE "public"."live_session_status" ADD VALUE 'in_progress' AFTER 'scheduled';
