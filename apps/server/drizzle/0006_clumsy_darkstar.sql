CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "chat_messages_thread_idx";--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "session_id" uuid;--> statement-breakpoint
INSERT INTO "chat_sessions" ("agent_id", "user_id", "title", "created_at", "last_message_at")
SELECT m."agent_id", m."user_id",
	coalesce(left((SELECT m2."text" FROM "chat_messages" m2
		WHERE m2."agent_id" = m."agent_id" AND m2."user_id" = m."user_id" AND m2."role" = 'user'
		ORDER BY m2."created_at" LIMIT 1), 64), 'Earlier chat'),
	min(m."created_at"), max(m."created_at")
FROM "chat_messages" m GROUP BY m."agent_id", m."user_id";--> statement-breakpoint
UPDATE "chat_messages" m SET "session_id" = s."id"
FROM "chat_sessions" s WHERE s."agent_id" = m."agent_id" AND s."user_id" = m."user_id";--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_sessions_owner_idx" ON "chat_sessions" USING btree ("agent_id","user_id","last_message_at");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_idx" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN "agent_id";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN "user_id";