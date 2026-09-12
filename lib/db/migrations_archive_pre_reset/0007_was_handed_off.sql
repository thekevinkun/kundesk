ALTER TABLE conversations 
ADD COLUMN was_handed_off boolean NOT NULL DEFAULT false;

-- Backfill existing data — any conversation that was ever handed off
-- handoffStatus "human" or "pending_handoff" means it was handed off
-- "ai" with takenOverAt set means it was handed off and returned — catch those too
UPDATE conversations
SET was_handed_off = true
WHERE handoff_status IN ('human', 'pending_handoff')
    OR taken_over_at IS NOT NULL;