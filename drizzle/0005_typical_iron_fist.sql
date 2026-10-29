ALTER TABLE "session_queue_items" ADD COLUMN "requested_nickname" varchar(40);--> statement-breakpoint
ALTER TABLE "session_queue_items" ADD COLUMN "request_token" varchar(80);--> statement-breakpoint
ALTER TABLE "session_queue_items" ADD COLUMN "queue_order" bigint;--> statement-breakpoint
WITH ranked AS (
	SELECT "id", (floor(extract(epoch FROM "created_at") * 1000)::bigint + row_number() OVER (PARTITION BY "session_id" ORDER BY "position", "id")) AS "value"
	FROM "session_queue_items"
)
UPDATE "session_queue_items" AS item SET "queue_order" = ranked."value" FROM ranked WHERE item."id" = ranked."id";--> statement-breakpoint
ALTER TABLE "session_queue_items" ALTER COLUMN "queue_order" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "session_queue_session_request_token_idx" ON "session_queue_items" USING btree ("session_id","request_token");
