CREATE TABLE "settlement_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"provider_user_id" uuid,
	"provider_micros" bigint NOT NULL,
	"fee_micros" bigint NOT NULL,
	"tx_signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "settlement_claims_provider_idx" ON "settlement_claims" USING btree ("provider_user_id","created_at");