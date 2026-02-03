-- Trigger pour synchroniser automatiquement les emails générés (via N8N)
-- vers la table campaign_prospects utilisée par l'interface UI

CREATE OR REPLACE FUNCTION public.sync_cold_email_to_campaign_link()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Mettre à jour le lien prospect-campagne avec le contenu généré
    UPDATE public.campaign_prospects
    SET 
        email_status = 'generated',
        generated_email_subject = NEW.subject,
        generated_email_content = NEW.message,
        email_generated_at = NOW(),
        updated_at = NOW()
    WHERE campaign_id = NEW.campaign_id 
      AND prospect_id = NEW.prospect_id;

    -- 2. Vérifier si tous les prospects du Job ont été générés pour passer le Job en 'completed'
    -- (Optionnel mais recommandé pour la cohérence)
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

-- Suppression du trigger s'il existe déjà pour éviter les doublons
DROP TRIGGER IF EXISTS on_cold_email_generated ON public.cold_email_generations;

-- Création du trigger
CREATE TRIGGER on_cold_email_generated
AFTER INSERT ON public.cold_email_generations
FOR EACH ROW
EXECUTE FUNCTION public.sync_cold_email_to_campaign_link();
