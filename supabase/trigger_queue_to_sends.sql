-- =================================================================
-- TRIGGER : email_queue → email_sends + email_events
-- Déclenché quand une ligne de email_queue passe en statut 'sent'
-- (que ce soit n8n ou le CRON interne qui mette à jour)
-- =================================================================

-- -----------------------------------------------------------------
-- ÉTAPE 1 : Ajouter smtp_configuration_id dans email_queue
-- (si la colonne n'existe pas encore — idempotent)
-- C'est ici qu'on sait quel compte d'envoi a été utilisé
-- -----------------------------------------------------------------
ALTER TABLE email_queue
    ADD COLUMN IF NOT EXISTS smtp_configuration_id UUID REFERENCES smtp_configurations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS provider_message_id TEXT;  -- ex: l'ID retourné par Mailgun

-- -----------------------------------------------------------------
-- ÉTAPE 2 : Fonction trigger
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_queue_sent_to_email_sends()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- permet d'insérer même si RLS bloque le service role
AS $$
DECLARE
    v_user_id       UUID;
    v_from_email    TEXT;
    v_from_name     TEXT;
    v_provider      TEXT := 'automation';
    v_smtp_id       UUID;
    v_subject       TEXT;
    v_html          TEXT;
    v_body_text     TEXT;
    v_to_email      TEXT;
    v_email_send_id UUID;
BEGIN
    -- On ne se déclenche que sur le passage à 'sent'
    IF NEW.status <> 'sent' OR OLD.status = 'sent' THEN
        RETURN NEW;
    END IF;

    -- ── 1. Récupérer user_id et infos campagne ──────────────────────
    SELECT c.user_id
    INTO v_user_id
    FROM cold_email_campaigns c
    WHERE c.id = NEW.campaign_id;

    IF v_user_id IS NULL THEN
        RAISE WARNING 'fn_queue_sent: campagne % introuvable', NEW.campaign_id;
        RETURN NEW;
    END IF;

    -- ── 2. Récupérer le compte d'envoi (SMTP/Mailgun) ──────────────
    -- Priorité : colonne direct sur email_queue, sinon via campaign_schedules
    v_smtp_id := NEW.smtp_configuration_id;

    IF v_smtp_id IS NULL THEN
        SELECT cs.smtp_configuration_id
        INTO v_smtp_id
        FROM campaign_schedules cs
        WHERE cs.id = NEW.schedule_id;
    END IF;

    IF v_smtp_id IS NULL THEN
        -- Dernier recours : premier compte actif de l'utilisateur
        SELECT sc.id
        INTO v_smtp_id
        FROM smtp_configurations sc
        WHERE sc.user_id = v_user_id
          AND sc.is_active = true
        ORDER BY sc.created_at
        LIMIT 1;
    END IF;

    -- ── 3. Récupérer from_email et provider depuis smtp_configurations ─
    IF v_smtp_id IS NOT NULL THEN
        SELECT sc.from_email, sc.provider, sc.from_name
        INTO v_from_email, v_provider, v_from_name
        FROM smtp_configurations sc
        WHERE sc.id = v_smtp_id;
    END IF;

    -- ── 4. Récupérer l'email du prospect ───────────────────────────
    SELECT
        CASE
            WHEN jsonb_typeof(sp.email_adresse_verified::jsonb) = 'array'
            THEN (sp.email_adresse_verified::jsonb ->> 0)
            ELSE sp.email_adresse_verified::text
        END
    INTO v_to_email
    FROM scrape_prospect sp
    WHERE sp.id_prospect = NEW.prospect_id;

    -- ── 5. Récupérer le contenu de l'email généré ──────────────────
    -- On cherche dans campaign_prospects (source de vérité la plus récente)
    SELECT
        cp.generated_email_subject,
        cp.generated_email_html,
        cp.generated_email_text
    INTO v_subject, v_html, v_body_text
    FROM campaign_prospects cp
    WHERE cp.campaign_id = NEW.campaign_id
      AND cp.prospect_id = NEW.prospect_id
    LIMIT 1;

    -- Fallback sur cold_email_generations si campaign_prospects n'a pas le contenu
    IF v_subject IS NULL THEN
        SELECT ceg.subject, ceg.body_html, ceg.body_text
        INTO v_subject, v_html, v_body_text
        FROM cold_email_generations ceg
        WHERE ceg.campaign_id = NEW.campaign_id
          AND ceg.prospect_id = NEW.prospect_id
        ORDER BY ceg.created_at DESC
        LIMIT 1;
    END IF;

    -- ── 6. Insérer dans email_sends ────────────────────────────────
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
        NULL,                       -- lead_id = UUID mais prospect_id est BIGINT, on laisse NULL (pas de FK)
        v_smtp_id,
        COALESCE(v_provider, 'automation'),
        NEW.provider_message_id,    -- si n8n l'a rempli dans email_queue
        COALESCE(v_from_email, 'unknown@unknown.com'),
        COALESCE(v_to_email, 'unknown@unknown.com'),
        v_subject,
        v_html,
        v_body_text,
        'accepted',                 -- Mailgun / SMTP a accepté le message
        COALESCE(NEW.sent_at, NOW()),
        NOW()
    )
    RETURNING id INTO v_email_send_id;

    -- ── 7. Insérer un event dans email_events ─────────────────────
    -- email_events = journal horodaté de tout ce qui se passe sur un envoi
    -- Ici on enregistre l'événement initial "sent" (accepté par le provider)
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
            COALESCE(v_provider, 'automation'),
            'sent',                             -- type d'événement
            COALESCE(v_to_email, 'unknown'),
            NEW.provider_message_id,
            COALESCE(NEW.sent_at, NOW()),
            jsonb_build_object(
                'source',       'automation_trigger',
                'queue_id',     NEW.id,
                'campaign_id',  NEW.campaign_id,
                'prospect_id',  NEW.prospect_id,
                'schedule_id',  NEW.schedule_id
            ),
            NOW()
        );
    END IF;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- Ne jamais bloquer la mise à jour de email_queue même si le trigger plante
    RAISE WARNING 'fn_queue_sent_to_email_sends ERREUR: % — %', SQLERRM, NEW.id;
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------
-- ÉTAPE 3 : Créer le trigger AFTER UPDATE sur email_queue
-- -----------------------------------------------------------------
DROP TRIGGER IF EXISTS tg_queue_sent_to_email_sends ON email_queue;

CREATE TRIGGER tg_queue_sent_to_email_sends
    AFTER UPDATE OF status ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_sent_to_email_sends();

-- -----------------------------------------------------------------
-- VÉRIFICATION : afficher les triggers créés
-- -----------------------------------------------------------------
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'tg_queue_sent_to_email_sends';
