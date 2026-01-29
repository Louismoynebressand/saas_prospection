-- ============================================
-- Performance Indexes - VERSION MINIMALE SÛRE
-- Créé: 2026-01-29
-- Index UNIQUEMENT sur les tables qu'on sait qui existent
-- ============================================

-- ============================================
-- 1. scrape_prospect (table confirmée)
-- ============================================

-- Index principal sur id_jobs (FK le plus utilisé)
CREATE INDEX IF NOT EXISTS idx_scrape_prospect_id_jobs 
ON scrape_prospect(id_jobs);

-- Index composite pour pagination
CREATE INDEX IF NOT EXISTS idx_scrape_prospect_job_created 
ON scrape_prospect(id_jobs, created_at DESC);

-- ============================================
-- 2. scrape_jobs (table confirmée)
-- ============================================

-- Index composite pour liste user (pattern le plus fréquent)
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_created 
ON scrape_jobs(id_user, created_at DESC);

-- Index sur statut
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status 
ON scrape_jobs(statut);

-- Index composite user + status
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_status 
ON scrape_jobs(id_user, statut);

-- ============================================
-- 3. cold_email_campaigns (table confirmée)
-- ============================================

-- Index composite pour liste user
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created 
ON cold_email_campaigns(user_id, created_at DESC);

-- Index sur is_active
CREATE INDEX IF NOT EXISTS idx_campaigns_active 
ON cold_email_campaigns(is_active) 
WHERE is_active = true;

-- Index composite user + active
CREATE INDEX IF NOT EXISTS idx_campaigns_user_active 
ON cold_email_campaigns(user_id, is_active);

-- ============================================
-- 4. quotas (table confirmée)
-- ============================================

-- Index simple sur user_id
CREATE INDEX IF NOT EXISTS idx_quotas_user 
ON quotas(user_id);

-- ============================================
-- FIN - INDEX ESSENTIELS CRÉÉS
-- ============================================
-- Total: 10 index sur 4 tables critiques
-- Si d'autres tables existent (email_generations, etc.)
-- on peut ajouter leurs index après vérification
-- ============================================
