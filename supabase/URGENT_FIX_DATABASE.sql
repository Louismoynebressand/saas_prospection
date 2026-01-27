-- =================================================================
-- 🚨 SCRIPT DE RÉPARATION URGENT - À EXÉCUTER DANS SUPABASE 🚨
-- =================================================================
-- Ce script corrige l'erreur "406 Not Acceptable" en réparant les permissions.
-- L'erreur est causée par des politiques de sécurité qui cherchent une colonne "user_id"
-- alors que votre base de données utilise "id_user".

BEGIN;

-- 1. Réparer la table `scrape_jobs`
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques erronées
DROP POLICY IF EXISTS "Allow all for demo-user on scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can view their own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can insert their own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can update their own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can delete their own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON public.scrape_jobs;

-- Créer les BONNES politiques (id_user = auth.uid())
CREATE POLICY "fix_view_jobs" ON public.scrape_jobs FOR SELECT USING (auth.uid()::text = id_user);
CREATE POLICY "fix_insert_jobs" ON public.scrape_jobs FOR INSERT WITH CHECK (auth.uid()::text = id_user);
CREATE POLICY "fix_update_jobs" ON public.scrape_jobs FOR UPDATE USING (auth.uid()::text = id_user);
CREATE POLICY "fix_delete_jobs" ON public.scrape_jobs FOR DELETE USING (auth.uid()::text = id_user);


-- 2. Réparer la table `scrape_prospect`
ALTER TABLE public.scrape_prospect ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques erronées
DROP POLICY IF EXISTS "Allow all for demo-user on prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Users can view their own prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Users can insert their own prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Users can update their own prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Users can delete their own prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Users can view their own scrape_prospect" ON public.scrape_prospect; -- cas potentiel

-- Créer les BONNES politiques
CREATE POLICY "fix_view_prospects" ON public.scrape_prospect FOR SELECT USING (auth.uid()::text = id_user);
CREATE POLICY "fix_insert_prospects" ON public.scrape_prospect FOR INSERT WITH CHECK (auth.uid()::text = id_user);
CREATE POLICY "fix_update_prospects" ON public.scrape_prospect FOR UPDATE USING (auth.uid()::text = id_user);
CREATE POLICY "fix_delete_prospects" ON public.scrape_prospect FOR DELETE USING (auth.uid()::text = id_user);


-- 3. Rafraîchir le cache de l'API (CRITIQUE pour l'erreur 406)
NOTIFY pgrst, 'reload schema';

COMMIT;
