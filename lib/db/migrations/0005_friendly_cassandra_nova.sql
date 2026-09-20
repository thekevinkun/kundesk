CREATE TABLE "business_profiles" (
	"org_id" text PRIMARY KEY NOT NULL,
	"about" text,
	"address" text,
	"contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payment_methods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"org_id" text NOT NULL,
	"section_id" integer NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"price" jsonb,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"sync_status" text DEFAULT 'stale' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_sections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_sections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunks" ALTER COLUMN "document_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "entry_id" integer;--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "section_id" integer;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_section_id_knowledge_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."knowledge_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sections" ADD CONSTRAINT "knowledge_sections_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_entries_org_id_idx" ON "knowledge_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "knowledge_entries_section_sort_idx" ON "knowledge_entries" USING btree ("section_id","sort_order");--> statement-breakpoint
CREATE INDEX "knowledge_sections_org_sort_idx" ON "knowledge_sections" USING btree ("org_id","sort_order");--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_entry_id_knowledge_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."knowledge_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_section_id_knowledge_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."knowledge_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_entry_id_idx" ON "chunks" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "chunks_section_id_idx" ON "chunks" USING btree ("section_id");--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_single_owner_chk" CHECK (num_nonnulls("chunks"."document_id", "chunks"."entry_id", "chunks"."section_id") = 1);