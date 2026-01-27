-- Script pour afficher le schéma RÉEL de la table scrape_jobs
-- Exécute ce script dans Supabase SQL Editor pour voir la vraie structure

-- Afficher toutes les colonnes de scrape_jobs
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'scrape_jobs'
ORDER BY ordinal_position;

-- Afficher la clé primaire
SELECT conname AS constraint_name, 
       a.attname AS column_name
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
WHERE t.relname = 'scrape_jobs'
AND c.contype = 'p';
