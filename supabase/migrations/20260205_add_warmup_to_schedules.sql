-- Add warm-up progression fields to campaign_schedules
ALTER TABLE campaign_schedules
ADD COLUMN IF NOT EXISTS enable_warmup BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS warmup_start_limit INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS warmup_increment INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS warmup_days_per_step INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS warmup_target_limit INTEGER,
ADD COLUMN IF NOT EXISTS warmup_current_day INTEGER;

-- Comments explaining the warm-up columns
COMMENT ON COLUMN campaign_schedules.enable_warmup IS 'Enable progressive warm-up (recommended for new domains)';
COMMENT ON COLUMN campaign_schedules.warmup_start_limit IS 'Starting daily limit for warm-up (e.g., 2-3 emails/day)';
COMMENT ON COLUMN campaign_schedules.warmup_increment IS 'Number of emails to add per step (e.g., +1 or +2)';
COMMENT ON COLUMN campaign_schedules.warmup_days_per_step IS 'Days before increasing the limit (e.g., 2-3 days)';
COMMENT ON COLUMN campaign_schedules.warmup_target_limit IS 'Target daily limit to reach after warm-up completion';
COMMENT ON COLUMN campaign_schedules.warmup_current_day IS 'Current day counter for warm-up progression (NULL when disabled)';
