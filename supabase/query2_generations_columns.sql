-- REQUÊTE 2: Colonnes de cold_email_generations
-- Copiez et exécutez cette requête en DEUXIÈME
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'cold_email_generations'
ORDER BY ordinal_position;
