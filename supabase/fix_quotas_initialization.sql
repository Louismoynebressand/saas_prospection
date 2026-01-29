-- ============================================
-- FIX: Initialize Quotas for New Users 
-- Problem: New users don't have quotas row created
-- Solution: Add quotas initialization to handle_new_user trigger
-- ============================================

-- Update the handle_new_user function to also create quotas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, first_name, last_name, company_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, '')
  );
  
  -- Create initial quotas for new user
  INSERT INTO public.quotas (
    user_id,
    scraps_used,
    scraps_limit,
    deep_search_used,
    deep_search_limit,
    cold_emails_used,
    cold_emails_limit,
    check_email_used,
    check_email_limit
  ) VALUES (
    NEW.id,
    0,   -- scraps_used
    20,  -- scraps_limit
    0,   -- deep_search_used
    5,   -- deep_search_limit
    0,   -- cold_emails_used
    20,  -- cold_emails_limit
    0,   -- check_email_used
    20   -- check_email_limit
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================
-- Verify existing users have quotas
-- Run this to check if any users are missing quotas
-- ============================================
SELECT 
    u.id as user_id,
    u.email,
    CASE 
        WHEN q.user_id IS NULL THEN 'MISSING QUOTAS'
        ELSE 'HAS QUOTAS'
    END as status
FROM auth.users u
LEFT JOIN public.quotas q ON q.user_id = u.id
ORDER BY u.created_at DESC;

-- ============================================
-- FIX: Create quotas for existing users who don't have any
-- Run this if you see users with MISSING QUOTAS above
-- ============================================
INSERT INTO public.quotas (
    user_id,
    scraps_used, scraps_limit,
    deep_search_used, deep_search_limit,
    cold_emails_used, cold_emails_limit,
    check_email_used, check_email_limit
)
SELECT 
    u.id,
    0, 20,  -- scraps
    0, 5,   -- deep_search
    0, 20,  -- cold_emails
    0, 20   -- check_email
FROM auth.users u
LEFT JOIN public.quotas q ON q.user_id = u.id
WHERE q.user_id IS NULL;  -- Only insert for users without quotas
