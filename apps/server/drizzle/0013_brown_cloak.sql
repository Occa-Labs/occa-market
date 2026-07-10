CREATE TABLE "x402_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"provider_user_id" uuid,
	"payer" text NOT NULL,
	"price_micros" bigint NOT NULL,
	"fee_micros" bigint NOT NULL,
	"tx_signature" text NOT NULL,
	"delivered" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "x402_charges_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE INDEX "x402_charges_agent_idx" ON "x402_charges" USING btree ("agent_id","created_at");