ALTER TABLE "chat_sessions" ADD COLUMN "share_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_share_id_unique" UNIQUE("share_id");