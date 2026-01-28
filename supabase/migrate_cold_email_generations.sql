-- ============================================================
-- MIGRATION COLD EMAIL GENERATIONS - AMÉLIORATION
-- Ajouter statut, variant, personnalisation, feedback, tracking
-- ============================================================

BEGIN;

-- 1. STATUT DE L'EMAIL
ALTER TABLE cold_email_generations
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT' 
    CHECK (status IN ('DRAFT', 'APPROVED', 'SENT', 'REPLIED', 'BOUNCED', 'ARCHIVED'));

-- 2. VARIANT (pour A/B testing)
ALTER TABLE cold_email_generations
ADD COLUMN IF NOT EXISTS variant_number INTEGER DEFAULT 1;

-- 3. DONNÉES DE PERSONNALISATION UTILISÉES
ALTER TABLE cold_email_generations
ADD COLUMN IF NOT EXISTS personalization_data JSONB DEFAULT '{}'::jsonb;

-- 4. FEEDBACK UTILISATEUR (1-5 étoiles)
ALTER TABLE cold_email_generations
ADD COLUMN IF NOT EXISTS feedback_score INTEGER 
    CHECK (feedback_score IS NULL OR (feedback_score BETWEEN 1 AND 5));

-- 5. TRACKING TIMESTAMPS
ALTER TABLE cold_email_generations
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;

-- 6. INDEX POUR PERFORMANCES
CREATE INDEX IF NOT EXISTS idx_generations_campaign 
ON cold_email_generations(campaign_id);

CREATE INDEX IF NOT EXISTS idx_generations_user_status 
ON cold_email_generations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_generations_created 
ON cold_email_generations(created_at DESC);

COMMIT;

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'cold_email_generations' 
    AND column_name IN (
        'status', 
        'variant_number', 
        'personalization_data', 
        'feedback_score',
        'sent_at',
        'opened_at',
        'replied_at'
    );
