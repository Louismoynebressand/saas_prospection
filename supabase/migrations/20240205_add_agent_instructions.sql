-- Add agent_instructions to cold_email_campaigns
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS agent_instructions TEXT DEFAULT NULL;

COMMENT ON COLUMN cold_email_campaigns.agent_instructions IS 'Custom context/instructions for the AI agent generating emails.';
