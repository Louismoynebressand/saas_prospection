-- 🛡️ CHECK SECURITY POLICIES
-- Lists all RLS policies for the campaigns table

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'cold_email_campaigns';
