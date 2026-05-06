-- =================================================================
-- Ajout des statuts de tracking dans email_queue
-- opened, delivered, clicked, replied
-- Et mise à jour des triggers de sync pour mapping 1:1
-- =================================================================

-- -----------------------------------------------------------------
-- ÉTAPE 1 : Étendre la contrainte CHECK de email_queue
-- -----------------------------------------------------------------
ALTER TABLE email_queue
    DROP CONSTRAINT IF EXISTS email_queue_status_check;

ALTER TABLE email_queue
    ADD CONSTRAINT email_queue_status_check
    CHECK (status IN (
        'pending',
        'processing',
        'sent',
        'delivered',
        'opened',
        'clicked',
        'replied',
        'failed',
        'skipped',
        'cancelled'
    ));

-- -----------------------------------------------------------------
-- ÉTAPE 2 : Mettre à jour le trigger email_queue → campaign_prospects
-- Mapping complet 1:1 maintenant que email_queue supporte tous les statuts
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_queue_status_to_cp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_cp_status     TEXT;
    v_current_cp_status TEXT;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    -- Mapping 1:1 complet
    v_new_cp_status := CASE NEW.status
        WHEN 'pending'    THEN 'generated'
        WHEN 'processing' THEN 'sending'
        WHEN 'sent'       THEN 'sent'
        WHEN 'delivered'  THEN 'delivered'
        WHEN 'opened'     THEN 'opened'
        WHEN 'clicked'    THEN 'clicked'
        WHEN 'replied'    THEN 'replied'
        WHEN 'failed'     THEN 'bounced'
        ELSE NULL
    END;

    IF v_new_cp_status IS NULL THEN RETURN NEW; END IF;

    SELECT email_status INTO v_current_cp_status
    FROM campaign_prospects
    WHERE campaign_id = NEW.campaign_id AND prospect_id = NEW.prospect_id;

    IF v_current_cp_status IS DISTINCT FROM v_new_cp_status THEN
        UPDATE campaign_prospects
        SET email_status = v_new_cp_status,
            email_sent_at = CASE
                WHEN NEW.status = 'sent' AND email_sent_at IS NULL
                THEN COALESCE(NEW.sent_at, NOW())
                ELSE email_sent_at
            END,
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id AND prospect_id = NEW.prospect_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[fn_queue_status_to_cp] %', SQLERRM;
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------
-- ÉTAPE 3 : Mettre à jour le trigger campaign_prospects → email_queue
-- Mapping 1:1 complet
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cp_status_to_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_queue_status     TEXT;
    v_current_queue_status TEXT;
BEGIN
    IF NEW.email_status IS NOT DISTINCT FROM OLD.email_status THEN
        RETURN NEW;
    END IF;

    -- Mapping 1:1 complet
    v_new_queue_status := CASE NEW.email_status
        WHEN 'generated'  THEN 'pending'
        WHEN 'sending'    THEN 'processing'
        WHEN 'sent'       THEN 'sent'
        WHEN 'delivered'  THEN 'delivered'
        WHEN 'opened'     THEN 'opened'
        WHEN 'clicked'    THEN 'clicked'
        WHEN 'replied'    THEN 'replied'
        WHEN 'bounced'    THEN 'failed'
        ELSE NULL
    END;

    IF v_new_queue_status IS NULL THEN RETURN NEW; END IF;

    SELECT status INTO v_current_queue_status
    FROM email_queue
    WHERE campaign_id = NEW.campaign_id AND prospect_id = NEW.prospect_id;

    IF v_current_queue_status IS DISTINCT FROM v_new_queue_status THEN
        UPDATE email_queue
        SET status = v_new_queue_status,
            sent_at = CASE
                WHEN NEW.email_status = 'sent' AND sent_at IS NULL
                THEN COALESCE(NEW.email_sent_at, NOW())
                ELSE sent_at
            END,
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id AND prospect_id = NEW.prospect_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[fn_cp_status_to_queue] %', SQLERRM;
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------
-- ÉTAPE 4 : One-shot sync avec mapping 1:1
-- Met à jour email_queue pour les statuts ouverts/delivered/clicked
-- -----------------------------------------------------------------
UPDATE email_queue eq
SET
    status = CASE cp.email_status
        WHEN 'generated'  THEN 'pending'
        WHEN 'sending'    THEN 'processing'
        WHEN 'sent'       THEN 'sent'
        WHEN 'delivered'  THEN 'delivered'
        WHEN 'opened'     THEN 'opened'
        WHEN 'clicked'    THEN 'clicked'
        WHEN 'replied'    THEN 'replied'
        WHEN 'bounced'    THEN 'failed'
        ELSE eq.status
    END,
    updated_at = NOW()
FROM campaign_prospects cp
WHERE cp.campaign_id = eq.campaign_id
  AND cp.prospect_id = eq.prospect_id
  AND cp.email_status NOT IN ('not_generated')
  AND CASE cp.email_status
        WHEN 'generated'  THEN 'pending'
        WHEN 'sending'    THEN 'processing'
        WHEN 'sent'       THEN 'sent'
        WHEN 'delivered'  THEN 'delivered'
        WHEN 'opened'     THEN 'opened'
        WHEN 'clicked'    THEN 'clicked'
        WHEN 'replied'    THEN 'replied'
        WHEN 'bounced'    THEN 'failed'
        ELSE eq.status
      END IS DISTINCT FROM eq.status;

-- -----------------------------------------------------------------
-- VÉRIFICATION
-- -----------------------------------------------------------------
SELECT
    eq.status           AS queue_status,
    cp.email_status     AS cp_status,
    COUNT(*)            AS nb_lignes
FROM email_queue eq
JOIN campaign_prospects cp
  ON cp.campaign_id = eq.campaign_id
 AND cp.prospect_id = eq.prospect_id
GROUP BY eq.status, cp.email_status
ORDER BY nb_lignes DESC;
