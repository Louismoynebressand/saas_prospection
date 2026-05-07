-- =================================================================
-- AUTO QUOTA : Cold Email Generations
-- =================================================================

-- Fonction pour incrémenter le quota à chaque génération (nouvelle)
CREATE OR REPLACE FUNCTION public.increment_quota_after_generation()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Récupérer le user_id depuis la campagne
    SELECT user_id INTO v_user_id
    FROM public.cold_email_campaigns
    WHERE id = NEW.campaign_id;

    IF v_user_id IS NOT NULL THEN
        UPDATE public.quotas
        SET cold_emails_used = COALESCE(cold_emails_used, 0) + 1,
            updated_at = NOW()
        WHERE user_id = v_user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour les nouvelles générations
DROP TRIGGER IF EXISTS tg_increment_quota_after_generation ON public.cold_email_generations;
CREATE TRIGGER tg_increment_quota_after_generation
AFTER INSERT ON public.cold_email_generations
FOR EACH ROW
EXECUTE FUNCTION public.increment_quota_after_generation();


-- -----------------------------------------------------------------
-- MAJ de handle_cold_email_upsert pour gérer le quota lors d'une régénération
-- (car le trigger AFTER INSERT ne se déclenche pas si c'est un doublon)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_cold_email_upsert()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
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

        -- Mettre à jour campaign_prospects directement
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

        -- INCÉRMENTER LE QUOTA POUR LA RÉGÉNÉRATION
        SELECT user_id INTO v_user_id
        FROM public.cold_email_campaigns
        WHERE id = NEW.campaign_id;

        IF v_user_id IS NOT NULL THEN
            UPDATE public.quotas
            SET cold_emails_used = COALESCE(cold_emails_used, 0) + 1,
                updated_at = NOW()
            WHERE user_id = v_user_id;
        END IF;

        RETURN NULL; -- Annule l'INSERT (UPSERT déjà fait)
    END IF;

    RETURN NEW; -- Pas de doublon → INSERT normal
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
