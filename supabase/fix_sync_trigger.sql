-- Fonction pour synchroniser automatiquement les emails générés de campaign_prospects vers cold_email_generations
-- Cela permet de remplir le Dashboard même si N8N ne tape que dans campaign_prospects.

CREATE OR REPLACE FUNCTION public.sync_cold_email_generation()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_latest_job_id uuid;
BEGIN
  -- On ne déclenche que si le statut passe à 'generated' et qu'il y a du contenu
  IF NEW.email_status = 'generated' AND NEW.generated_email_content IS NOT NULL THEN
    
    -- 1. Récupérer l'ID utilisateur via la campagne
    SELECT user_id INTO v_user_id
    FROM public.cold_email_campaigns
    WHERE id = NEW.campaign_id;
    
    -- 2. Récupérer le Job ID le plus pertinent (le dernier actif pour cette campagne)
    -- C'est une heuristique car campaign_prospects ne stocke pas le job_id directement
    SELECT id INTO v_latest_job_id
    FROM public.cold_email_jobs
    WHERE campaign_id = NEW.campaign_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Si aucun job trouvé, on ne peut pas insérer (car job_id not null souvent), 
    -- sauf si on a rendu job_id nullable. Dans le doute, on insert seulement si on a un job.
    IF v_latest_job_id IS NOT NULL THEN
        INSERT INTO public.cold_email_generations (
          job_id,
          user_id,
          campaign_id,
          prospect_id,
          subject,
          message,
          created_at
        ) VALUES (
          v_latest_job_id,
          v_user_id,
          NEW.campaign_id,
          NEW.prospect_id::text, -- Cast bigint to text
          NEW.generated_email_subject,
          NEW.generated_email_content,
          NOW()
        );
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Création du Trigger
DROP TRIGGER IF EXISTS on_email_generated ON public.campaign_prospects;
CREATE TRIGGER on_email_generated
  AFTER UPDATE ON public.campaign_prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cold_email_generation();
