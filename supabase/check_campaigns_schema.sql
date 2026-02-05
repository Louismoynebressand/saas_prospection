-- Check actual columns in cold_email_campaigns table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cold_email_campaigns'
ORDER BY ordinal_position;

-- This will show us exactly what columns exist in the database
-- Look for either 'nom_campagne' or 'campaign_name' in the results
