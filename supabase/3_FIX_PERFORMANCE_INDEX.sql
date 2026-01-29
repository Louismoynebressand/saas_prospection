-- ============================================
-- FIX: PERFORMANCES CRITIQUES & LOADING INFINI
-- DATE: 2026-01-29
-- ============================================

-- 1. Optimisation Page Prospects (CRITIQUE)
-- La requête "WHERE id_user = ..." scanne toute la table sans cet index.
-- C'est la cause principale du chargement infini après un scrap.
CREATE INDEX IF NOT EXISTS idx_scrape_prospect_user_created 
ON public.scrape_prospect(id_user, created_at DESC);

-- 2. Optimisation Widget & Historique
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_created 
ON public.scrape_jobs(id_user, created_at DESC);

-- 3. Optimisation Quotas
CREATE INDEX IF NOT EXISTS idx_quotas_user_id 
ON public.quotas(user_id);

-- 4. Optimisation Email Verifier
CREATE INDEX IF NOT EXISTS idx_email_results_job 
ON public.email_verification_results(id_job);

-- ============================================
-- INSTRUCTIONS:
-- Copiez tout ce contenu et exécutez-le dans 
-- l'éditeur SQL de votre tableau de bord Supabase.
-- ============================================
