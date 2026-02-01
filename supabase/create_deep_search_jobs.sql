-- Table pour tracker les jobs de Deep Search lancés après coup
-- (différent de scrape_jobs qui gère les recherches initiales)

CREATE TABLE IF NOT EXISTS deep_search_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Prospects à traiter
    prospect_ids bigint[] NOT NULL,
    prospects_total integer NOT NULL,
    prospects_processed integer DEFAULT 0,
    
    -- Statut du job
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    error_message text,
    
    -- Métadonnées
    created_at timestamptz DEFAULT NOW(),
    started_at timestamptz,
    completed_at timestamptz
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_deep_search_jobs_user_id ON deep_search_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_search_jobs_status ON deep_search_jobs(status);
CREATE INDEX IF NOT EXISTS idx_deep_search_jobs_created_at ON deep_search_jobs(created_at DESC);

-- RLS Policies
ALTER TABLE deep_search_jobs ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres jobs
CREATE POLICY "Users can view own deep search jobs"
    ON deep_search_jobs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Les utilisateurs peuvent créer leurs propres jobs
CREATE POLICY "Users can create own deep search jobs"
    ON deep_search_jobs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent mettre à jour leurs propres jobs
CREATE POLICY "Users can update own deep search jobs"
    ON deep_search_jobs
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Commentaires
COMMENT ON TABLE deep_search_jobs IS 'Jobs de Deep Search lancés manuellement après le scrape initial';
COMMENT ON COLUMN deep_search_jobs.prospect_ids IS 'Array des ID prospects à enrichir';
COMMENT ON COLUMN deep_search_jobs.prospects_total IS 'Nombre total de prospects dans ce job';
COMMENT ON COLUMN deep_search_jobs.prospects_processed IS 'Nombre de prospects traités (mis à jour par n8n)';
