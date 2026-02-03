-- Inspection des types de colonnes pour debug le trigger
SELECT 
    table_name, 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns
WHERE table_name IN ('cold_email_generations', 'campaign_prospects')
AND column_name IN ('prospect_id', 'campaign_id', 'id')
ORDER BY table_name, column_name;
