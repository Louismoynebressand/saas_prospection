-- Add missing fields to cold_email_campaigns for the AI Wizard
ALTER TABLE public.cold_email_campaigns 
ADD COLUMN IF NOT EXISTS my_company_name text,
ADD COLUMN IF NOT EXISTS my_website text,
ADD COLUMN IF NOT EXISTS pitch text,
ADD COLUMN IF NOT EXISTS main_offer text,
ADD COLUMN IF NOT EXISTS pain_points text[];

-- Update the check constraint for status if needed (it seems fine based on schema)
-- check (status in ('draft', 'active', 'paused', 'completed'))
