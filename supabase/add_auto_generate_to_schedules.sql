-- =================================================================
-- Ajout de l'option "génération automatique avant envoi"
-- Table : campaign_schedules
-- Colonne : auto_generate (boolean, default false)
-- =================================================================

ALTER TABLE campaign_schedules
    ADD COLUMN IF NOT EXISTS auto_generate BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN campaign_schedules.auto_generate IS
    'Si true, n8n doit générer automatiquement les emails manquants avant chaque cycle d''envoi journalier';

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'campaign_schedules'
  AND column_name = 'auto_generate';
