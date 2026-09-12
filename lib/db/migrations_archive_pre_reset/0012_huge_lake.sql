ALTER TABLE "payments" ALTER COLUMN "payment_method" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "paid_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "paid_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "redirect_url" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "payments_org_status_created_idx" ON "payments" USING btree ("org_id","status","created_at");