-- ============================================================
-- MIGRATION COLD EMAIL CAMPAIGNS - PHASE 2: AJOUT CHAMPS CRITIQUES
-- Ajouter objective, signature, ciblage, paramètres email, statut
-- ============================================================

BEGIN;

-- 1. OBJECTIF DE CAMPAGNE (P0 - Critique)
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS objective VARCHAR(50) CHECK (objective IN (
    'BOOK_MEETING',
    'DEMO',
    'FREE_TRIAL',
    'QUOTE',
    'DISCOUNT',
    'CALLBACK',
    'DOWNLOAD',
    'WEBINAR'
));

-- 2. BLOC SIGNATURE (P0 - Critique)
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS signature_name TEXT,
ADD COLUMN IF NOT EXISTS signature_title TEXT,
ADD COLUMN IF NOT EXISTS signature_company TEXT,
ADD COLUMN IF NOT EXISTS signature_phone TEXT,
ADD COLUMN IF NOT EXISTS signature_email TEXT,
ADD COLUMN IF NOT EXISTS signature_ps TEXT;

-- 3. CIBLAGE AMÉLIORÉ (P0)
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS target_sectors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS target_company_size VARCHAR(20),
ADD COLUMN IF NOT EXISTS target_job_titles JSONB DEFAULT '[]'::jsonb;

-- 4. PARAMÈTRES EMAIL (P0)
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS email_length VARCHAR(20) DEFAULT 'STANDARD' 
    CHECK (email_length IN ('CONCISE', 'STANDARD', 'DETAILED'));

ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS personalization_level VARCHAR(20) DEFAULT 'MEDIUM' 
    CHECK (personalization_level IN ('LOW', 'MEDIUM', 'HIGH'));

ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'fr' 
    CHECK (language IN ('fr', 'en'));

-- 5. STATUT & VERSIONING (P0)
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT' 
    CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'));

ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

-- 6. Mettre à jour le trigger updated_at si nécessaire
CREATE OR REPLACE FUNCTION update_cold_email_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cold_email_campaigns_timestamp ON cold_email_campaigns;

CREATE TRIGGER update_cold_email_campaigns_timestamp
BEFORE UPDATE ON cold_email_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_cold_email_campaigns_updated_at();

COMMIT;

-- Vérification
SELECT 
    column_name, 
    data_type, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'cold_email_campaigns' 
    AND column_name IN (
        'objective', 
        'signature_name', 
        'target_sectors', 
        'email_length', 
        'status'
    );
