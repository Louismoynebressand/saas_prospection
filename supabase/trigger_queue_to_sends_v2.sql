-- =================================================================
-- TRIGGER v2 : email_queue → email_sends + email_events
-- VERSION ROBUSTE — gère les colonnes manquantes et les types variables
-- =================================================================

-- -----------------------------------------------------------------
-- ÉTAPE 1 : Colonnes supplémentaires sur email_queue (idempotent)
-- -----------------------------------------------------------------
ALTER TABLE email_queue
    ADD COLUMN IF NOT EXISTS smtp_configuration_id UUID REFERENCES smtp_configurations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS provider_message_id   TEXT;

-- -----------------------------------------------------------------
-- ÉTAPE 2 : Fonction trigger robuste
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_queue_sent_to_email_sends()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- sécurité: évite le search_path injection
AS $$
DECLARE
    v_user_id        UUID;
    v_from_email     TEXT  := 'no-reply@automation.local';
    v_provider       TEXT  := 'automation';
    v_smtp_id        UUID;
    v_subject        TEXT;
    v_html           TEXT;
    v_body_text      TEXT;
    v_to_email       TEXT;
    v_email_send_id  UUID;
    v_raw_email      TEXT;
BEGIN
    -- ── Guard : uniquement sur passage -> 'sent' ────────────────────
    IF NEW.status IS DISTINCT FROM 'sent' OR OLD.status = 'sent' THEN
        RETURN NEW;
    END IF;

    -- ── 1. user_id via cold_email_campaigns ────────────────────────
    SELECT c.user_id
    INTO   v_user_id
    FROM   cold_email_campaigns c
    WHERE  c.id = NEW.campaign_id;

    -- Impossible de créer un email_send sans user_id → on log et on sort
    IF v_user_id IS NULL THEN
        RAISE WARNING '[trigger queue→sends] campagne % introuvable pour queue %', NEW.campaign_id, NEW.id;
        RETURN NEW;
    END IF;

    -- ── 2. SMTP / provider ─────────────────────────────────────────
    -- Priorité 1 : champ direct sur la ligne de queue (si n8n l'a rempli)
    v_smtp_id := NEW.smtp_configuration_id;

    -- Priorité 2 : via campaign_schedules
    IF v_smtp_id IS NULL AND NEW.schedule_id IS NOT NULL THEN
        SELECT cs.smtp_configuration_id
        INTO   v_smtp_id
        FROM   campaign_schedules cs
        WHERE  cs.id = NEW.schedule_id;
    END IF;

    -- Priorité 3 : premier compte actif de l'utilisateur
    IF v_smtp_id IS NULL THEN
        SELECT sc.id
        INTO   v_smtp_id
        FROM   smtp_configurations sc
        WHERE  sc.user_id = v_user_id
          AND  sc.is_active = true
        ORDER  BY sc.created_at
        LIMIT  1;
    END IF;

    -- Récupérer from_email + provider (non bloquant si NULL)
    IF v_smtp_id IS NOT NULL THEN
        SELECT COALESCE(sc.from_email, 'no-reply@automation.local'),
               COALESCE(sc.provider, 'automation')
        INTO   v_from_email, v_provider
        FROM   smtp_configurations sc
        WHERE  sc.id = v_smtp_id;
    END IF;

    -- ── 3. Email du prospect (gère TEXT brut ET JSON array) ─────────
    SELECT sp.email_adresse_verified::text
    INTO   v_raw_email
    FROM   scrape_prospect sp
    WHERE  sp.id_prospect = NEW.prospect_id;

    IF v_raw_email IS NOT NULL THEN
        -- Si c'est un tableau JSON ["email@x.com", ...]
        IF left(trim(v_raw_email), 1) = '[' THEN
            BEGIN
                v_to_email := (v_raw_email::jsonb) ->> 0;
            EXCEPTION WHEN OTHERS THEN
                v_to_email := v_raw_email; -- fallback brut
            END;
        ELSE
            v_to_email := trim(v_raw_email, '"'); -- enlève les guillemets si JSON string
        END IF;
    END IF;

    -- ── 4. Contenu email ─────────────────────────────────────────────
    -- Source 1 : cold_email_generations (plus fiable, toujours présente)
    SELECT ceg.subject, ceg.body_html, ceg.body_text
    INTO   v_subject, v_html, v_body_text
    FROM   cold_email_generations ceg
    WHERE  ceg.campaign_id = NEW.campaign_id
      AND  ceg.prospect_id = NEW.prospect_id::text   -- cold_email_generations.prospect_id peut être TEXT
    ORDER  BY ceg.created_at DESC
    LIMIT  1;

    -- Source 2 : essai avec prospect_id en BIGINT cast (si la colonne est différente)
    IF v_subject IS NULL THEN
        SELECT ceg.subject, ceg.body_html, ceg.body_text
        INTO   v_subject, v_html, v_body_text
        FROM   cold_email_generations ceg
        WHERE  ceg.campaign_id  = NEW.campaign_id
          AND  ceg.prospect_id::bigint = NEW.prospect_id
        ORDER  BY ceg.created_at DESC
        LIMIT  1;
    END IF;

    -- ── 5. INSERT dans email_sends ────────────────────────────────
    INSERT INTO email_sends (
        user_id,
        campaign_id,
        lead_id,
        sending_account_id,
        provider,
        provider_message_id,
        from_email,
        to_email,
        subject,
        html,
        body_text,
        status,
        sent_at,
        created_at
    )
    VALUES (
        v_user_id,
        NEW.campaign_id,
        NULL,                                        -- lead_id UUID non rempli (prospect_id est BIGINT)
        v_smtp_id,
        v_provider,
        NEW.provider_message_id,
        v_from_email,
        COALESCE(v_to_email, 'unknown@unknown.com'),
        v_subject,
        v_html,
        v_body_text,
        'accepted',
        COALESCE(NEW.sent_at, NOW()),
        NOW()
    )
    RETURNING id INTO v_email_send_id;

    -- ── 6. INSERT dans email_events ───────────────────────────────
    IF v_email_send_id IS NOT NULL THEN
        INSERT INTO email_events (
            email_send_id,
            provider,
            event_type,
            recipient,
            provider_message_id,
            event_timestamp,
            raw_payload,
            created_at
        )
        VALUES (
            v_email_send_id,
            v_provider,
            'sent',
            COALESCE(v_to_email, 'unknown'),
            NEW.provider_message_id,
            COALESCE(NEW.sent_at, NOW()),
            jsonb_build_object(
                'source',       'automation_queue_trigger',
                'queue_id',     NEW.id,
                'campaign_id',  NEW.campaign_id,
                'prospect_id',  NEW.prospect_id,
                'schedule_id',  NEW.schedule_id,
                'smtp_id',      v_smtp_id
            ),
            NOW()
        );
    END IF;

    RAISE LOG '[trigger queue→sends] OK — queue: %, email_send: %, to: %',
        NEW.id, v_email_send_id, v_to_email;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- Log détaillé — ne bloque PAS la mise à jour de email_queue
    RAISE WARNING '[trigger queue→sends] ERREUR queue_id=% : % (SQLSTATE=%)',
        NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------
-- ÉTAPE 3 : Recréer le trigger (DROP + CREATE pour être sûr)
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS tg_queue_sent_to_email_sends ON email_queue;

CREATE TRIGGER tg_queue_sent_to_email_sends
    AFTER UPDATE OF status ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_sent_to_email_sends();

-- -----------------------------------------------------------------
-- VÉRIFICATION FINALE
-- -----------------------------------------------------------------
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'tg_queue_sent_to_email_sends';
