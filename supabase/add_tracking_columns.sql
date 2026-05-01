-- Migration: Ajout des colonnes de tracking manquantes + contrainte complète
-- À exécuter dans le SQL Editor de Supabase

-- 1. Ajouter les colonnes de timestamps manquantes
ALTER TABLE public.campaign_prospects
    ADD COLUMN IF NOT EXISTS email_opened_at timestamptz,
    ADD COLUMN IF NOT EXISTS email_delivered_at timestamptz,
    ADD COLUMN IF NOT EXISTS email_clicked_at timestamptz,
    ADD COLUMN IF NOT EXISTS email_bounced_at timestamptz,
    ADD COLUMN IF NOT EXISTS provider_message_id text; -- ID Mailgun pour le tracking

-- 2. Mise à jour de la contrainte de statut (tous les statuts du cycle de vie)
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

-- 3. Commentaires de documentation
COMMENT ON COLUMN campaign_prospects.email_opened_at IS 'When the email was first opened (Mailgun event)';
COMMENT ON COLUMN campaign_prospects.email_delivered_at IS 'When the email was confirmed delivered (Mailgun event)';
COMMENT ON COLUMN campaign_prospects.email_clicked_at IS 'When a link in the email was clicked (Mailgun event)';
COMMENT ON COLUMN campaign_prospects.email_bounced_at IS 'When the email bounced (Mailgun event)';
COMMENT ON COLUMN campaign_prospects.provider_message_id IS 'Mailgun message ID for event reconciliation';
