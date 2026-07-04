CREATE TABLE "daily_anchors" (
	"agent_id" text NOT NULL,
	"day_unix" bigint NOT NULL,
	"merkle_root" text NOT NULL,
	"task_count" integer NOT NULL,
	"tx_sig" text NOT NULL,
	"committed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_anchors_agent_id_day_unix_pk" PRIMARY KEY("agent_id","day_unix")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "onchain" jsonb;--> statement-breakpoint
ALTER TABLE "daily_anchors" ADD CONSTRAINT "daily_anchors_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;