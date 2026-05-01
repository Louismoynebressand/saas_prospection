-- Ajout de la colonne sent_via_automation dans campaign_prospects
-- Permet de tracer si l'email a été envoyé par l'automatisation n8n ou manuellement

ALTER TABLE public.campaign_prospects
    ADD COLUMN IF NOT EXISTS sent_via_automation boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS automation_sent_at timestamptz;

COMMENT ON COLUMN campaign_prospects.sent_via_automation IS 'True si envoyé par le workflow n8n autonome, false si envoi manuel';
COMMENT ON COLUMN campaign_prospects.automation_sent_at IS 'Timestamp de l envoi automatique par n8n';
