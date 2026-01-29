-- ============================================
-- VÉRIFICATION DES TABLES EXISTANTES
-- Exécute cette requête AVANT de créer les index
-- ============================================

-- Liste toutes les tables du schéma public
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- Pour chaque table, liste les colonnes
-- ============================================
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
    'scrape_prospect',
    'scrape_jobs',
    'cold_email_campaigns',
    'email_generations',
    'quotas',
    'email_verification_jobs',
    'email_verification_results'
)
ORDER BY table_name, ordinal_position;
