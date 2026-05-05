-- =================================================================
-- AUTOMATISATION 1 : Sync bidirectionnel email_queue ↔ campaign_prospects
-- AUTOMATISATION 2 : Ajout prospect_email dans campaign_prospects
-- =================================================================
-- ⚠️  Exécuter ce fichier EN ENTIER dans Supabase SQL Editor
-- =================================================================


-- -----------------------------------------------------------------
-- PARTIE A : Colonne prospect_email dans campaign_prospects
-- -----------------------------------------------------------------
ALTER TABLE campaign_prospects
    ADD COLUMN IF NOT EXISTS prospect_email TEXT;

COMMENT ON COLUMN campaign_prospects.prospect_email IS
    'Email du prospect copié depuis scrape_prospect.email_adresse_verified — mis à jour automatiquement';

-- Remplissage des lignes existantes (one-shot)
UPDATE campaign_prospects cp
SET prospect_email = CASE
    WHEN left(trim(sp.email_adresse_verified), 1) = '['
    THEN (sp.email_adresse_verified::jsonb) ->> 0
    ELSE trim(sp.email_adresse_verified, '"')
END
FROM scrape_prospect sp
WHERE sp.id_prospect = cp.prospect_id
  AND sp.email_adresse_verified IS NOT NULL
  AND cp.prospect_email IS NULL;

-- Trigger : remplir prospect_email à chaque INSERT dans campaign_prospects
CREATE OR REPLACE FUNCTION fn_fill_prospect_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_raw TEXT;
BEGIN
    -- Lire l'email depuis scrape_prospect
    SELECT sp.email_adresse_verified::text
    INTO   v_raw
    FROM   scrape_prospect sp
    WHERE  sp.id_prospect = NEW.prospect_id;

    IF v_raw IS NOT NULL THEN
        IF left(trim(v_raw), 1) = '[' THEN
            BEGIN
                NEW.prospect_email := (v_raw::jsonb) ->> 0;
            EXCEPTION WHEN OTHERS THEN
                NEW.prospect_email := v_raw;
            END;
        ELSE
            NEW.prospect_email := trim(v_raw, '"');
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_fill_prospect_email ON campaign_prospects;
CREATE TRIGGER tg_fill_prospect_email
    BEFORE INSERT ON campaign_prospects
    FOR EACH ROW
    EXECUTE FUNCTION fn_fill_prospect_email();


-- -----------------------------------------------------------------
-- PARTIE B : Mapping des statuts
-- email_queue.status          → campaign_prospects.email_status
-- pending                     → generated  (en queue = déjà généré)
-- processing                  → sending
-- sent                        → sent
-- failed/skipped/cancelled    → (pas de changement dans cp)
--
-- campaign_prospects.email_status → email_queue.status
-- generated                   → pending
-- sending                     → processing
-- sent                        → sent
-- bounced/replied             → failed
-- opened/delivered/clicked    → (pas d'équivalent dans email_queue)
-- -----------------------------------------------------------------


-- -----------------------------------------------------------------
-- PARTIE C : Trigger email_queue → campaign_prospects
-- Quand on modifie le statut dans email_queue (ex: n8n),
-- ça se répercute dans campaign_prospects
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_queue_status_to_cp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_cp_status TEXT;
    v_current_cp_status TEXT;
BEGIN
    -- Guard : seulement sur changement de statut
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    -- Mapping email_queue.status → campaign_prospects.email_status
    v_new_cp_status := CASE NEW.status
        WHEN 'pending'    THEN 'generated'
        WHEN 'processing' THEN 'sending'
        WHEN 'sent'       THEN 'sent'
        ELSE NULL  -- failed/skipped/cancelled : ne pas écraser le statut cp
    END;

    IF v_new_cp_status IS NULL THEN
        RETURN NEW;
    END IF;

    -- Lire le statut actuel dans campaign_prospects pour éviter les boucles
    SELECT email_status INTO v_current_cp_status
    FROM campaign_prospects
    WHERE campaign_id = NEW.campaign_id
      AND prospect_id = NEW.prospect_id;

    -- Mettre à jour seulement si différent (anti-boucle)
    IF v_current_cp_status IS DISTINCT FROM v_new_cp_status THEN
        UPDATE campaign_prospects
        SET email_status = v_new_cp_status,
            email_sent_at = CASE WHEN NEW.status = 'sent' THEN COALESCE(NEW.sent_at, NOW()) ELSE email_sent_at END,
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id
          AND prospect_id = NEW.prospect_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[fn_queue_status_to_cp] ERREUR: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_queue_status_to_cp ON email_queue;
CREATE TRIGGER tg_queue_status_to_cp
    AFTER UPDATE OF status ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_status_to_cp();


-- -----------------------------------------------------------------
-- PARTIE D : Trigger campaign_prospects → email_queue
-- Quand on modifie le statut dans campaign_prospects (ex: manuellement
-- dans l'app), ça se répercute dans email_queue
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cp_status_to_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_queue_status TEXT;
    v_current_queue_status TEXT;
BEGIN
    -- Guard : seulement sur changement de email_status
    IF NEW.email_status IS NOT DISTINCT FROM OLD.email_status THEN
        RETURN NEW;
    END IF;

    -- Mapping campaign_prospects.email_status → email_queue.status
    v_new_queue_status := CASE NEW.email_status
        WHEN 'generated' THEN 'pending'
        WHEN 'sending'   THEN 'processing'
        WHEN 'sent'      THEN 'sent'
        WHEN 'bounced'   THEN 'failed'
        WHEN 'replied'   THEN 'failed'  -- pas d'équivalent "replied" dans email_queue
        ELSE NULL  -- not_generated, delivered, opened, clicked : pas d'équivalent
    END;

    IF v_new_queue_status IS NULL THEN
        RETURN NEW;
    END IF;

    -- Lire le statut actuel dans email_queue pour éviter les boucles
    SELECT status INTO v_current_queue_status
    FROM email_queue
    WHERE campaign_id = NEW.campaign_id
      AND prospect_id = NEW.prospect_id;

    -- Mettre à jour seulement si une ligne existe ET si statut différent (anti-boucle)
    IF v_current_queue_status IS DISTINCT FROM v_new_queue_status THEN
        UPDATE email_queue
        SET status     = v_new_queue_status,
            sent_at    = CASE WHEN NEW.email_status = 'sent' THEN COALESCE(NEW.email_sent_at, NOW()) ELSE sent_at END,
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id
          AND prospect_id = NEW.prospect_id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[fn_cp_status_to_queue] ERREUR: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_cp_status_to_queue ON campaign_prospects;
CREATE TRIGGER tg_cp_status_to_queue
    AFTER UPDATE OF email_status ON campaign_prospects
    FOR EACH ROW
    EXECUTE FUNCTION fn_cp_status_to_queue();


-- -----------------------------------------------------------------
-- VÉRIFICATION FINALE
-- -----------------------------------------------------------------
SELECT
    trigger_name,
    event_object_table AS "table",
    event_manipulation AS "event",
    action_timing      AS "timing"
FROM information_schema.triggers
WHERE trigger_name IN (
    'tg_fill_prospect_email',
    'tg_queue_status_to_cp',
    'tg_cp_status_to_queue'
)
ORDER BY event_object_table;
