-- =============================================================================
-- FIX RPC FUNCTIONS - Consolidated Script
-- =============================================================================
-- This script drops and recreates all RPC functions to fix PGRST202 errors
-- Execute this in Supabase SQL Editor

-- Drop all possible variations of these functions
DROP FUNCTION IF EXISTS public.check_quota(text, uuid);
DROP FUNCTION IF EXISTS public.check_quota(uuid, text);
DROP FUNCTION IF EXISTS public.decrement_quota(text, uuid);
DROP FUNCTION IF EXISTS public.decrement_quota(uuid, text);

-- =============================================================================
-- Function: check_quota
-- Purpose: Check if user has quota available for a specific quota type
-- Returns: boolean (true if quota available, false otherwise)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_quota(
    p_user_id uuid,
    p_quota_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_used int;
    v_limit int;
BEGIN
    -- Get quota usage and limit based on type
    IF p_quota_type = 'scraps' THEN
        SELECT scraps_used, scraps_limit INTO v_used, v_limit
        FROM public.quotas
        WHERE user_id = p_user_id;
    ELSIF p_quota_type = 'deep_search' THEN
        SELECT deep_search_used, deep_search_limit INTO v_used, v_limit
        FROM public.quotas
        WHERE user_id = p_user_id;
    ELSIF p_quota_type = 'emails' THEN
        SELECT cold_emails_used, cold_emails_limit INTO v_used, v_limit
        FROM public.quotas
        WHERE user_id = p_user_id;
    ELSE
        RETURN false;
    END IF;
    
    -- If no quota row found, return false
    IF v_used IS NULL OR v_limit IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if user has quota available
    RETURN v_used < v_limit;
END;
$$;

-- =============================================================================
-- Function: decrement_quota
-- Purpose: Safely decrement user quota for a specific type
-- Returns: void
-- =============================================================================
CREATE OR REPLACE FUNCTION public.decrement_quota(
    p_user_id uuid,
    p_quota_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_quota_type = 'scraps' THEN
        UPDATE public.quotas
        SET scraps_used = scraps_used + 1,
            updated_at = now()
        WHERE user_id = p_user_id;
    ELSIF p_quota_type = 'deep_search' THEN
        UPDATE public.quotas
        SET deep_search_used = deep_search_used + 1,
            updated_at = now()
        WHERE user_id = p_user_id;
    ELSIF p_quota_type = 'emails' THEN
        UPDATE public.quotas
        SET cold_emails_used = cold_emails_used + 1,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.check_quota TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_quota TO authenticated;

-- Verify functions were created
SELECT 
    routine_name, 
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('check_quota', 'decrement_quota');
