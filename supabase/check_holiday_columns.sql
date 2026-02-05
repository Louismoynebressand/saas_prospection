-- Check if holiday exclusion columns exist in campaign_schedules table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'campaign_schedules'
  AND column_name IN ('exclude_holidays', 'blocked_dates')
ORDER BY column_name;

-- If the above returns 0 rows, the migration needs to be applied
-- If it returns 2 rows, the columns exist and should be working
