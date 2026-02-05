-- Remove restrictive CHECK constraint on provider column
-- This allows any string value for provider, not just the original 4 values

-- Drop the existing constraint
ALTER TABLE smtp_configurations 
DROP CONSTRAINT IF EXISTS smtp_configurations_provider_check;

-- The provider column will now accept any TEXT value
-- No new constraint is added, maintaining flexibility for all SMTP providers
