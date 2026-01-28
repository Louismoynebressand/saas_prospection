-- ============================================================
-- MIGRATION COLD EMAIL CAMPAIGNS - PHASE 3: NICE-TO-HAVE
-- Ajouter différenciation, preuves, objections, garanties
-- ============================================================

BEGIN;

-- 1. DIFFÉRENCIATION & USP
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS differentiators JSONB DEFAULT '[]'::jsonb;

-- 2. PREUVE SOCIALE & CHIFFRES
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS proof_points JSONB DEFAULT '[]'::jsonb;

-- 3. ÉTUDES DE CAS / TÉMOIGNAGES
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS case_studies JSONB DEFAULT '[]'::jsonb;

-- 4. GESTION DES OBJECTIONS
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS objection_handling JSONB DEFAULT '{}'::jsonb;

-- 5. GARANTIES
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS guarantees TEXT;

-- 6. HINT PRICING
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS pricing_hint TEXT;

-- 7. CTA PERSONNALISÉ (si objective ne suffit pas)
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS call_to_action TEXT;

COMMIT;

-- Vérification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cold_email_campaigns' 
    AND column_name IN (
        'differentiators', 
        'proof_points', 
        'case_studies', 
        'objection_handling',
        'guarantees',
        'pricing_hint',
        'call_to_action'
    );
