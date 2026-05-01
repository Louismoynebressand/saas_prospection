-- Fix: Rendre les INSERT dans cold_email_generations idempotents
-- Un doublon (campaign_id, prospect_id) ne plante plus, il met à jour l'existant

-- 1. Supprimer d'abord l'ancien trigger BEFORE INSERT s'il existe
DROP TRIGGER IF EXISTS before_cold_email_upsert ON public.cold_email_generations;
DROP FUNCTION IF EXISTS public.handle_cold_email_upsert();

-- 2. Créer une fonction qui convertit les INSERTs en UPSERT silencieux
CREATE OR REPLACE FUNCTION public.handle_cold_email_upsert()
RETURNS TRIGGER AS $$
BEGIN
    -- Si un enregistrement (campaign_id, prospect_id) existe déjà,
    -- on met à jour les champs au lieu de planter avec une erreur de doublon
    IF EXISTS (
        SELECT 1 FROM public.cold_email_generations
        WHERE campaign_id = NEW.campaign_id
          AND prospect_id::text = NEW.prospect_id::text
    ) THEN
        UPDATE public.cold_email_generations
        SET
            subject    = COALESCE(NEW.subject, subject),
            body_html  = COALESCE(NEW.body_html, body_html),
            body_text  = COALESCE(NEW.body_text, body_text),
            job_id     = COALESCE(NEW.job_id, job_id),
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id
          AND prospect_id::text = NEW.prospect_id::text;

        RETURN NULL; -- Annule l'INSERT (la mise à jour est déjà faite)
    END IF;

    RETURN NEW; -- Laisse passer l'INSERT (pas de doublon)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attacher le trigger BEFORE INSERT
CREATE TRIGGER before_cold_email_upsert
BEFORE INSERT ON public.cold_email_generations
FOR EACH ROW
EXECUTE FUNCTION public.handle_cold_email_upsert();
