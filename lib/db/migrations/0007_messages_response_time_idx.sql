CREATE INDEX "messages_org_assistant_response_time_idx"
  ON "messages" ("org_id", "response_time_ms")
  WHERE "role" = 'assistant' AND "response_time_ms" IS NOT NULL;