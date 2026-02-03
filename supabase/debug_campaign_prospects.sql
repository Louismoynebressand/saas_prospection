-- check types
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaign_prospects';

-- check policies
select * from pg_policies where tablename = 'campaign_prospects';

-- check distinct status values
SELECT DISTINCT email_status FROM campaign_prospects;

-- check specific prospect if possible (replace ID with a known one if testing)
-- SELECT * FROM campaign_prospects LIMIT 5;
