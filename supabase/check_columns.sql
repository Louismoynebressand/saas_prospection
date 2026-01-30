SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    udt_name
FROM information_schema.columns
WHERE table_name = 'cold_email_campaigns'
ORDER BY column_name;
