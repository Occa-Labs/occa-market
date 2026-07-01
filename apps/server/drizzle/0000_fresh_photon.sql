CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"handle" text NOT NULL,
	"glyph" text NOT NULL,
	"tagline" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"price_per_msg" double precision NOT NULL,
	"reputation" integer DEFAULT 0 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"provider" text NOT NULL,
	"seed" boolean DEFAULT false NOT NULL,
	"accent" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_handle_unique" UNIQUE("handle")
);
