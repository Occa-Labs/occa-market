CREATE TABLE "message_ratings" (
	"message_id" uuid PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_ratings" ADD CONSTRAINT "message_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_ratings_agent_idx" ON "message_ratings" USING btree ("agent_id");