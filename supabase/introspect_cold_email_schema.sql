-- ============================================================
-- INTROSPECTION DU SCHÉMA COLD EMAIL
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. COLONNES DE LA TABLE cold_email_campaigns
-- ============================================================
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

-- 2. COLONNES DE LA TABLE cold_email_generations
-- ============================================================
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

-- 3. CONTRAINTES ET CLÉS (Primary Keys, Foreign Keys, Unique)
-- ============================================================
SELECT
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('cold_email_campaigns', 'cold_email_generations')
ORDER BY tc.table_name, tc.constraint_type;

-- 4. INDEX SUR LES TABLES
-- ============================================================
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('cold_email_campaigns', 'cold_email_generations')
ORDER BY tablename, indexname;

-- 5. POLITIQUES RLS (Row Level Security)
-- ============================================================
SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('cold_email_campaigns', 'cold_email_generations')
ORDER BY tablename, policyname;

-- 6. TRIGGERS SUR LES TABLES
-- ============================================================
SELECT
    event_object_table AS table_name,
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('cold_email_campaigns', 'cold_email_generations')
ORDER BY event_object_table, trigger_name;

-- 7. EXEMPLES DE DONNÉES (pour comprendre l'usage réel)
-- ============================================================
-- Campagnes (limité aux 3 plus récentes)
SELECT *
FROM cold_email_campaigns
ORDER BY created_at DESC
LIMIT 3;

-- Générations (limité aux 3 plus récentes)
SELECT *
FROM cold_email_generations
ORDER BY created_at DESC
LIMIT 3;
