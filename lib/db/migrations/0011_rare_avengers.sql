DROP INDEX "notifications_is_read_idx";--> statement-breakpoint
CREATE INDEX "conversations_org_handoff_status_idx" ON "conversations" USING btree ("org_id","handoff_status");--> statement-breakpoint
CREATE INDEX "notifications_org_created_idx" ON "notifications" USING btree ("org_id","created_at");--> statement-breakpoint
ALTER TABLE "chatbots" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "chatbots" DROP COLUMN "tone";--> statement-breakpoint
ALTER TABLE "chatbots" DROP COLUMN "greeting_message";