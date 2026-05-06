-- =================================================================
-- FIX COMPLET : sync cold_email_generations → campaign_prospects
-- Problèmes identifiés :
-- 1. before_cold_email_upsert utilise body_html/body_text (colonnes inexistantes)
--    → message est la bonne colonne
-- 2. on_cold_email_generated utilise aussi body_html/body_text au lieu de message
-- 3. Quand RETURN NULL (doublon), les AFTER INSERT ne se déclenchent pas
--    → il faut que le UPSERT déclenche aussi la mise à jour de campaign_prospects
-- =================================================================

-- -----------------------------------------------------------------
-- ÉTAPE 1 : Corriger handle_cold_email_upsert
-- Ajouter message dans le UPDATE, ET mettre à jour campaign_prospects
-- directement depuis ce trigger (cas doublon)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_cold_email_upsert()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.cold_email_generations
        WHERE campaign_id = NEW.campaign_id
          AND prospect_id::text = NEW.prospect_id::text
    ) THEN
        -- Mettre à jour cold_email_generations avec les bonnes colonnes
        UPDATE public.cold_email_generations
        SET
            subject    = COALESCE(NEW.subject, subject),
            message    = COALESCE(NEW.message, message),
            job_id     = COALESCE(NEW.job_id, job_id),
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id
          AND prospect_id::text = NEW.prospect_id::text;

        -- Mettre à jour campaign_prospects directement (les AFTER INSERT ne se déclencheront pas)
        UPDATE public.campaign_prospects
        SET
            generated_email_subject = COALESCE(NEW.subject, generated_email_subject),
            generated_email_content = COALESCE(NEW.message, generated_email_content),
            email_status = CASE
                WHEN email_status IN ('not_generated', 'pending') THEN 'generated'
                ELSE email_status
            END,
            email_generated_at = COALESCE(email_generated_at, NOW()),
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id
          AND prospect_id::text = NEW.prospect_id::text;

        RETURN NULL; -- Annule l'INSERT (UPSERT déjà fait)
    END IF;

    RETURN NEW; -- Pas de doublon → INSERT normal
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------
-- ÉTAPE 2 : Corriger sync_cold_email_to_campaign_link
-- Remplacer body_html/body_text par message (la vraie colonne)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_cold_email_to_campaign_link()
RETURNS TRIGGER AS $$
DECLARE
    total_prospects INTEGER;
    generated_count INTEGER;
BEGIN
    -- Mettre à jour campaign_prospects avec le bon nom de colonne (message, pas body_html)
    UPDATE public.campaign_prospects
    SET
        email_status            = CASE
            WHEN email_status IN ('not_generated', 'pending') THEN 'generated'
            ELSE email_status
        END,
        generated_email_subject = NEW.subject,
        generated_email_content = NEW.message,
        email_generated_at      = COALESCE(email_generated_at, NOW()),
        updated_at              = NOW()
    WHERE campaign_id = NEW.campaign_id
      AND prospect_id::text = NEW.prospect_id::text;

    -- Vérifier si tous les prospects du Job ont été générés
    IF NEW.job_id IS NOT NULL THEN
        SELECT jsonb_array_length(prospect_ids) INTO total_prospects
        FROM public.cold_email_jobs
        WHERE id = NEW.job_id;

        SELECT count(*) INTO generated_count
        FROM public.cold_email_generations
        WHERE job_id = NEW.job_id;

        IF generated_count >= total_prospects THEN
            UPDATE public.cold_email_jobs
            SET status = 'completed', completed_at = NOW()
            WHERE id = NEW.job_id;
        ELSE
            UPDATE public.cold_email_jobs
            SET status = 'running'
            WHERE id = NEW.job_id AND status = 'pending';
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erreur dans sync_cold_email_to_campaign_link: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------
-- ÉTAPE 3 : Vérification — triggers actifs
-- -----------------------------------------------------------------
SELECT
    t.trigger_name,
    t.event_manipulation       AS "event",
    t.event_object_table       AS "table",
    t.action_timing            AS "timing"
FROM information_schema.triggers t
WHERE t.event_object_table IN ('cold_email_generations', 'campaign_prospects')
ORDER BY t.event_object_table, t.action_timing, t.trigger_name;
