-- Add holiday exclusion fields to campaign_schedules
ALTER TABLE campaign_schedules
ADD COLUMN IF NOT EXISTS exclude_holidays BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blocked_dates JSONB DEFAULT '[]';

-- Comment explaining the JSONB structure
COMMENT ON COLUMN campaign_schedules.blocked_dates IS 'Array of ISO date strings (YYYY-MM-DD) to exclude from sending.';
