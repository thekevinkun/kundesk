CREATE TABLE "promo_codes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promo_codes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"discount_percent" integer NOT NULL,
	"applicable_plans" text,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "has_used_first_purchase" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_code_idx" ON "promo_codes" USING btree ("code");