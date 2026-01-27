-- =================================================================
-- FIX COMPLET : Politiques RLS pour scrape_jobs
-- =================================================================
-- L'erreur 406 vient d'un problème de RLS qui empêche totalement l'accès
-- Ce script va SUPPRIMER toutes les anciennes politiques et en créer de nouvelles

-- 1. SUPPRIMER toutes les anciennes politiques
DROP POLICY IF EXISTS "Allow all for demo-user on scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can view their own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can insert their own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can update their own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Users can delete their own scrape_jobs" ON public.scrape_jobs;
DROP POLICY IF EXISTS "Enable all for dev user on scrape_jobs" ON public.scrape_jobs;

-- 2. Vérifier que RLS est activé
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

-- 3. Créer les NOUVELLES politiques avec le bon nom de colonne (id_user au lieu de user_id)
CREATE POLICY "Users can view their own jobs"
ON public.scrape_jobs FOR SELECT
USING (auth.uid()::text = id_user);

CREATE POLICY "Users can insert their own jobs"
ON public.scrape_jobs FOR INSERT
WITH CHECK (auth.uid()::text = id_user);

CREATE POLICY "Users can update their own jobs"
ON public.scrape_jobs FOR UPDATE
USING (auth.uid()::text = id_user);

CREATE POLICY "Users can delete their own jobs"
ON public.scrape_jobs FOR DELETE
USING (auth.uid()::text = id_user);

-- 4. IMPORTANT: Forcer PostgREST à recharger le schéma
NOTIFY pgrst, 'reload schema';
