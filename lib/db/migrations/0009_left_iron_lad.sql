CREATE INDEX "conversations_org_handoff_created_idx" ON "conversations" USING btree ("org_id","was_handed_off","created_at");--> statement-breakpoint
CREATE INDEX "conversations_org_channel_idx" ON "conversations" USING btree ("org_id","delivery_channel");--> statement-breakpoint
CREATE INDEX "messages_org_role_created_idx" ON "messages" USING btree ("org_id","role","created_at");