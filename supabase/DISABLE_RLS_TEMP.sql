-- =================================================================
-- 🛑 DÉSACTIVATION TEMPORAIRE DE LA SÉCURITÉ (RLS) 🛑
-- =================================================================
-- Ce script désactive la sécurité Row Level Security sur les tables concernées.
-- Cela rendra les données visibles pour TOUT LE MONDE temporairement.
-- C'est une étape de diagnostic : si ça marche après ça, c'est confirmé à 100% que c'est un problème de droits.

BEGIN;

-- Désactiver RLS sur scrape_jobs
ALTER TABLE public.scrape_jobs DISABLE ROW LEVEL SECURITY;

-- Désactiver RLS sur scrape_prospect
ALTER TABLE public.scrape_prospect DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

COMMIT;
