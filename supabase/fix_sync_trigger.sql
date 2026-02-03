-- Trigger CORRIGÉ avec CAST (Text -> BigInt)
-- Pour synchroniser cold_email_generations (prospect_id = text) -> campaign_prospects (prospect_id = int8)

CREATE OR REPLACE FUNCTION public.sync_cold_email_to_campaign_link()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Mettre à jour le lien prospect-campagne avec le contenu généré
    -- IMPORTANT: On cast NEW.prospect_id (text) en bigint pour matcher la table campaign_prospects
    BEGIN
        UPDATE public.campaign_prospects
        SET 
            email_status = 'generated',
            generated_email_subject = NEW.subject,
            generated_email_content = NEW.message,
            email_generated_at = NOW(),
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id 
          AND prospect_id = (NEW.prospect_id)::bigint; -- CAST EXPLICTE ICI
    EXCEPTION WHEN OTHERS THEN
        -- Sécurité si jamais prospect_id n'est pas un nombre (ne devrait pas arriver avec ta data actuelle)
        RAISE WARNING 'Echec conversion prospect_id % en bigint', NEW.prospect_id;
    END;

    -- 2. Vérifier si tous les prospects du Job ont été générés pour passer le Job en 'completed'
    UPDATE public.cold_email_jobs
    SET 
        status = 'completed',
        completed_at = NOW()
    WHERE id = NEW.job_id
      AND (
          SELECT count(*) 
          FROM public.cold_email_generations 
          WHERE job_id = NEW.job_id
      ) >= (
          SELECT jsonb_array_length(prospect_ids) 
          FROM public.cold_email_jobs 
          WHERE id = NEW.job_id
      );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-création du trigger
DROP TRIGGER IF EXISTS on_cold_email_generated ON public.cold_email_generations;

CREATE TRIGGER on_cold_email_generated
AFTER INSERT ON public.cold_email_generations
FOR EACH ROW
EXECUTE FUNCTION public.sync_cold_email_to_campaign_link();
