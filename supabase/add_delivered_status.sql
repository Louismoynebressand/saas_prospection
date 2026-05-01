-- Ajout du statut 'delivered' à la contrainte campaign_prospects
-- À exécuter dans le SQL Editor de Supabase

ALTER TABLE public.campaign_prospects 
DROP CONSTRAINT IF EXISTS campaign_prospects_email_status_check;

ALTER TABLE public.campaign_prospects 
ADD CONSTRAINT campaign_prospects_email_status_check 
CHECK (email_status IN (
    'not_generated',
    'pending',
    'generated', 
    'sending',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'replied'
));
