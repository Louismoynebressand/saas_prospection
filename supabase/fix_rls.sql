-- 🛡️ FIX RLS POLICIES
-- Ensures the user can SEE, EDIT, and DELETE their own campaigns.

ALTER TABLE cold_email_campaigns ENABLE ROW LEVEL SECURITY;

-- 1. View (Select)
DROP POLICY IF EXISTS "Users can view own campaigns" ON cold_email_campaigns;
CREATE POLICY "Users can view own campaigns" 
ON cold_email_campaigns FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Insert
DROP POLICY IF EXISTS "Users can create campaigns" ON cold_email_campaigns;
CREATE POLICY "Users can create campaigns" 
ON cold_email_campaigns FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Update
DROP POLICY IF EXISTS "Users can update own campaigns" ON cold_email_campaigns;
CREATE POLICY "Users can update own campaigns" 
ON cold_email_campaigns FOR UPDATE 
USING (auth.uid() = user_id);

-- 4. Delete
DROP POLICY IF EXISTS "Users can delete own campaigns" ON cold_email_campaigns;
CREATE POLICY "Users can delete own campaigns" 
ON cold_email_campaigns FOR DELETE 
USING (auth.uid() = user_id);
