-- =================================================================
-- FIX COMPLET : Politiques RLS pour scrape_prospect
-- =================================================================
-- Même problème que scrape_jobs : les politiques RLS utilisent les mauvais noms de colonnes

-- 1. SUPPRIMER toutes les anciennes politiques
DROP POLICY IF EXISTS "Allow all for demo-user on prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Users can view their own prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Users can insert their own prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Users can update their own prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Users can delete their own prospects" ON public.scrape_prospect;
DROP POLICY IF EXISTS "Enable all for dev user on scrape_prospect" ON public.scrape_prospect;

-- 2. Vérifier que RLS est activé
ALTER TABLE public.scrape_prospect ENABLE ROW LEVEL SECURITY;

-- 3. Créer les NOUVELLES politiques avec le bon nom de colonne (id_user au lieu de user_id)
CREATE POLICY "Users can view their own prospects"
ON public.scrape_prospect FOR SELECT
USING (auth.uid()::text = id_user);

CREATE POLICY "Users can insert their own prospects"
ON public.scrape_prospect FOR INSERT
WITH CHECK (auth.uid()::text = id_user);

CREATE POLICY "Users can update their own prospects"
ON public.scrape_prospect FOR UPDATE
USING (auth.uid()::text = id_user);

CREATE POLICY "Users can delete their own prospects"
ON public.scrape_prospect FOR DELETE
USING (auth.uid()::text = id_user);

-- 4. IMPORTANT: Forcer PostgREST à recharger le schéma
NOTIFY pgrst, 'reload schema';
