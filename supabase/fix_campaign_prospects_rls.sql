-- Enable RLS on campaign_prospects if not already enabled
ALTER TABLE IF EXISTS public.campaign_prospects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Users view their own campaign prospects" ON public.campaign_prospects;
DROP POLICY IF EXISTS "Users can manage their own campaign prospects" ON public.campaign_prospects;

-- Create comprehensive policy
CREATE POLICY "Users can manage their own campaign prospects"
ON public.campaign_prospects
FOR ALL
USING (
  campaign_id IN (
    SELECT id FROM public.cold_email_campaigns 
    WHERE user_id = auth.uid()
  )
);
