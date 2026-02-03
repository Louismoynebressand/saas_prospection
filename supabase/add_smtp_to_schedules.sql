-- Add smtp_configuration_id to campaign_schedules
ALTER TABLE campaign_schedules 
ADD COLUMN smtp_configuration_id UUID REFERENCES smtp_configurations(id);

-- Update RLS policy for campaign_schedules to ensure we can read/write this new column (usually covered by existing "*" policies but good to verify if explicit columns were used, here we used standard policies so it should be fine)

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_schedules_smtp_config ON campaign_schedules(smtp_configuration_id);
