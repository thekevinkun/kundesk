ALTER TABLE "payments" DROP CONSTRAINT "payments_org_id_org_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "deletion_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE set null ON UPDATE no action;