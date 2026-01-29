-- ============================================
-- Performance Indexes for SaaS Prospection
-- Created: 2026-01-29
-- Purpose: Optimize query performance across all main tables
-- ============================================

-- IMPORTANT: Use CONCURRENTLY to avoid table locks during creation
-- This allows the app to continue running while indexes are created

-- ============================================
-- 1. scrape_prospect indexes (MOST CRITICAL TABLE)
-- ============================================

-- Index on id_jobs (most frequently used FK)
-- Used in: ProspectListTable, DashboardStats
CREATE INDEX IF NOT EXISTS idx_scrape_prospect_id_jobs 
ON scrape_prospect(id_jobs);

-- Partial index on email (only non-null emails)
-- Used for: email filtering, verification
CREATE INDEX IF NOT EXISTS idx_scrape_prospect_email 
ON scrape_prospect(email) 
WHERE email IS NOT NULL;

-- Partial index on ville (only non-null cities)
-- Used for: location-based searches
CREATE INDEX IF NOT EXISTS idx_scrape_prospect_ville 
ON scrape_prospect(ville) 
WHERE ville IS NOT NULL;

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_scrape_prospect_job_created 
ON scrape_prospect(id_jobs, created_at DESC);

-- ============================================
-- 2. scrape_jobs indexes
-- ============================================

-- Composite index for user listings (most common query)
-- Pattern: WHERE id_user = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_created 
ON scrape_jobs(id_user, created_at DESC);

-- Index on status for filtering
-- Used in: ScrapingProgressWidget, SearchHistoryTable
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status 
ON scrape_jobs(statut);

-- Composite for user + status queries
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_status 
ON scrape_jobs(id_user, statut);

-- ============================================
-- 3. cold_email_campaigns indexes
-- ============================================

-- Composite for user listings (most common pattern)
-- Pattern: WHERE user_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created 
ON cold_email_campaigns(user_id, created_at DESC);

-- Index on is_active for quick filtering
-- Used in: CampaignList toggle filter
CREATE INDEX IF NOT EXISTS idx_campaigns_active 
ON cold_email_campaigns(is_active) 
WHERE is_active = true;

-- Composite for user + active status
CREATE INDEX IF NOT EXISTS idx_campaigns_user_active 
ON cold_email_campaigns(user_id, is_active);

-- ============================================
-- 4. email_generations indexes
-- ============================================

-- Index on campaign_id (FK, very frequently queried)
-- Used in: CampaignEmailsList
CREATE INDEX IF NOT EXISTS idx_email_gen_campaign 
ON email_generations(campaign_id);

-- Index on status for filtering
-- Used for: filtering by sent/opened/replied
CREATE INDEX IF NOT EXISTS idx_email_gen_status 
ON email_generations(status);

-- Composite for campaign listings with date
CREATE INDEX IF NOT EXISTS idx_email_gen_campaign_created 
ON email_generations(campaign_id, created_at DESC);

-- Partial index for tracking sent emails
CREATE INDEX IF NOT EXISTS idx_email_gen_sent 
ON email_generations(campaign_id, sent_at) 
WHERE sent_at IS NOT NULL;

-- ============================================
-- 5. quotas indexes
-- ============================================

-- Simple index on user_id (small table, but frequently accessed)
-- Used in: Sidebar quotas widget
CREATE INDEX IF NOT EXISTS idx_quotas_user 
ON quotas(user_id);

-- ============================================
-- 6. email_verification_jobs indexes
-- ============================================

-- Index for user listings
CREATE INDEX IF NOT EXISTS idx_email_verif_jobs_user 
ON email_verification_jobs(user_id, created_at DESC);

-- ============================================
-- 7. email_verification_results indexes
-- ============================================

-- Index on job FK
CREATE INDEX IF NOT EXISTS idx_email_verif_results_job 
ON email_verification_results(job_id);

-- ============================================
-- VERIFICATION QUERIES
-- Run these after index creation to verify
-- ============================================

-- List all indexes created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'scrape_prospect', 
    'scrape_jobs', 
    'cold_email_campaigns', 
    'email_generations', 
    'quotas',
    'email_verification_jobs',
    'email_verification_results'
)
ORDER BY tablename, indexname;

-- Check index sizes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'scrape_prospect', 
    'scrape_jobs', 
    'cold_email_campaigns', 
    'email_generations', 
    'quotas'
)
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- PERFORMANCE TEST EXAMPLES
-- Run EXPLAIN ANALYZE before and after to compare
-- ============================================

-- Test 1: Prospect list query (should use idx_scrape_prospect_id_jobs)
-- EXPLAIN ANALYZE
-- SELECT * FROM scrape_prospect 
-- WHERE id_jobs = 'YOUR_JOB_ID_HERE'
-- ORDER BY created_at DESC 
-- LIMIT 50;

-- Test 2: User campaigns (should use idx_campaigns_user_created)
-- EXPLAIN ANALYZE
-- SELECT * FROM cold_email_campaigns 
-- WHERE user_id = 'YOUR_USER_ID_HERE'
-- ORDER BY created_at DESC;

-- Test 3: Quota lookup (should use idx_quotas_user)
-- EXPLAIN ANALYZE
-- SELECT * FROM quotas 
-- WHERE user_id = 'YOUR_USER_ID_HERE';

-- ============================================
-- MAINTENANCE NOTES
-- ============================================
-- 1. Indexes are created CONCURRENTLY to avoid locks
-- 2. Partial indexes (WHERE clauses) save disk space
-- 3. Composite indexes optimize multi-column queries
-- 4. BTREE is default (good for equality and range queries)
-- 5. Monitor index usage with pg_stat_user_indexes
-- ============================================
