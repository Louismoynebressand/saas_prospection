-- =================================================================
-- TRIGGER v3 FINAL — colonnes corrigées
-- cold_email_generations : body_html → message, prospect_id = TEXT
-- =================================================================

-- Colonnes manquantes dans email_queue (idempotent)
ALTER TABLE email_queue
    ADD COLUMN IF NOT EXISTS smtp_configuration_id UUID REFERENCES smtp_configurations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS provider_message_id   TEXT;

-- Fonction trigger
CREATE OR REPLACE FUNCTION fn_queue_sent_to_email_sends()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id        UUID;
    v_from_email     TEXT := 'no-reply@automation.local';
    v_provider       TEXT := 'automation';
    v_smtp_id        UUID;
    v_subject        TEXT;
    v_body           TEXT;
    v_to_email       TEXT;
    v_raw_email      TEXT;
    v_email_send_id  UUID;
BEGIN
    -- Uniquement sur passage → 'sent'
    IF NEW.status IS DISTINCT FROM 'sent' OR OLD.status = 'sent' THEN
        RETURN NEW;
    END IF;

    -- 1. user_id
    SELECT c.user_id INTO v_user_id
    FROM cold_email_campaigns c WHERE c.id = NEW.campaign_id;
    IF v_user_id IS NULL THEN RETURN NEW; END IF;

    -- 2. SMTP (queue → schedule → fallback)
    v_smtp_id := NEW.smtp_configuration_id;
    IF v_smtp_id IS NULL AND NEW.schedule_id IS NOT NULL THEN
        SELECT cs.smtp_configuration_id INTO v_smtp_id
        FROM campaign_schedules cs WHERE cs.id = NEW.schedule_id;
    END IF;
    IF v_smtp_id IS NULL THEN
        SELECT sc.id INTO v_smtp_id FROM smtp_configurations sc
        WHERE sc.user_id = v_user_id AND sc.is_active = true
        ORDER BY sc.created_at LIMIT 1;
    END IF;
    IF v_smtp_id IS NOT NULL THEN
        SELECT sc.from_email, sc.provider INTO v_from_email, v_provider
        FROM smtp_configurations sc WHERE sc.id = v_smtp_id;
    END IF;

    -- 3. Email du prospect (TEXT brut ou JSON array)
    SELECT sp.email_adresse_verified::text INTO v_raw_email
    FROM scrape_prospect sp WHERE sp.id_prospect = NEW.prospect_id;
    IF v_raw_email IS NOT NULL THEN
        IF left(trim(v_raw_email), 1) = '[' THEN
            BEGIN v_to_email := (v_raw_email::jsonb) ->> 0;
            EXCEPTION WHEN OTHERS THEN v_to_email := v_raw_email; END;
        ELSE
            v_to_email := trim(v_raw_email, '"');
        END IF;
    END IF;

    -- 4. Contenu email (colonne = "message", prospect_id = TEXT)
    SELECT ceg.subject, ceg.message INTO v_subject, v_body
    FROM cold_email_generations ceg
    WHERE ceg.campaign_id = NEW.campaign_id
      AND ceg.prospect_id = NEW.prospect_id::text
    ORDER BY ceg.created_at DESC LIMIT 1;

    -- Fallback sans filtre prospect si non trouvé
    IF v_subject IS NULL THEN
        SELECT ceg.subject, ceg.message INTO v_subject, v_body
        FROM cold_email_generations ceg
        WHERE ceg.campaign_id = NEW.campaign_id
        ORDER BY ceg.created_at DESC LIMIT 1;
    END IF;

    -- 5. INSERT email_sends
    INSERT INTO email_sends (
        user_id, campaign_id, lead_id, sending_account_id,
        provider, provider_message_id, from_email, to_email,
        subject, html, body_text, status, sent_at, created_at
    ) VALUES (
        v_user_id, NEW.campaign_id, NULL, v_smtp_id,
        v_provider, NEW.provider_message_id, v_from_email,
        COALESCE(v_to_email, 'unknown@unknown.com'),
        v_subject, v_body, v_body,
        'accepted', COALESCE(NEW.sent_at, NOW()), NOW()
    )
    RETURNING id INTO v_email_send_id;

    -- 6. INSERT email_events
    IF v_email_send_id IS NOT NULL THEN
        INSERT INTO email_events (
            email_send_id, provider, event_type, recipient,
            provider_message_id, event_timestamp, raw_payload, created_at
        ) VALUES (
            v_email_send_id, v_provider, 'sent',
            COALESCE(v_to_email, 'unknown'),
            NEW.provider_message_id, COALESCE(NEW.sent_at, NOW()),
            jsonb_build_object(
                'source', 'automation_queue_trigger',
                'queue_id', NEW.id,
                'campaign_id', NEW.campaign_id,
                'prospect_id', NEW.prospect_id
            ),
            NOW()
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trigger queue→sends] ERREUR queue_id=% : % (SQLSTATE=%)',
        NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Recrée le trigger
DROP TRIGGER IF EXISTS tg_queue_sent_to_email_sends ON email_queue;
CREATE TRIGGER tg_queue_sent_to_email_sends
    AFTER UPDATE OF status ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_sent_to_email_sends();

-- Politique RLS pour permettre l'insertion par le trigger (SECURITY DEFINER)
DROP POLICY IF EXISTS "Service trigger can insert email_sends" ON email_sends;
CREATE POLICY "Service trigger can insert email_sends"
    ON email_sends FOR INSERT
    WITH CHECK (true);

-- Vérification
SELECT 'Trigger installé ✅' AS status,
       trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'tg_queue_sent_to_email_sends';
