-- REQUÊTE 1: Colonnes de cold_email_campaigns
-- Copiez et exécutez cette requête en PREMIER
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'cold_email_campaigns'
ORDER BY ordinal_position;
