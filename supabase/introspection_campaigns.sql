SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%campaign%' OR table_name LIKE '%email%' OR table_name LIKE '%job%');

SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND (table_name LIKE '%campaign%' OR table_name LIKE '%email%' OR table_name LIKE '%job%')
ORDER BY table_name, ordinal_position;
