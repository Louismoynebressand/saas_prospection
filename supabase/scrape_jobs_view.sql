-- ============================================
-- SQL View: scrape_jobs_with_counts
-- Purpose: Pre-calculate prospect counts to eliminate N+1 queries
-- Created: 2026-01-29
-- ============================================

-- Drop view if exists (for re-running this script)
DROP VIEW IF EXISTS scrape_jobs_with_counts;

-- Create view with pre-calculated prospect counts
CREATE VIEW scrape_jobs_with_counts AS
SELECT 
    sj.id_jobs,
    sj.id_user,
    sj.request_search,
    sj.resuest_ville,
    sj.statut,
    sj.created_at,
    COALESCE(COUNT(sp.id_prospect), 0) as prospects_count
FROM scrape_jobs sj
LEFT JOIN scrape_prospect sp ON sp.id_jobs::text = sj.id_jobs::text
GROUP BY sj.id_jobs, sj.id_user, sj.request_search, sj.resuest_ville, sj.statut, sj.created_at;

-- Grant permissions
GRANT SELECT ON scrape_jobs_with_counts TO authenticated;
GRANT SELECT ON scrape_jobs_with_counts TO anon;

-- ============================================
-- Verification Query
-- ============================================
-- Run this to verify the view works correctly:
/*
SELECT 
    id_jobs,
    request_search,
    prospects_count,
    created_at
FROM scrape_jobs_with_counts
ORDER BY created_at DESC
LIMIT 10;
*/

-- ============================================
-- Performance Comparison
-- ============================================
-- BEFORE (N+1 queries):
-- 1. SELECT * FROM scrape_jobs WHERE id_user = X (1 query)
-- 2. For each job: SELECT COUNT(*) FROM scrape_prospect WHERE id_jobs = Y (N queries)
-- Total: N+1 queries

-- AFTER (with view):
-- 1. SELECT * FROM scrape_jobs_with_counts WHERE id_user = X (1 query)
-- Total: 1 query

-- Expected performance gain: 50-90% faster for lists with many jobs
