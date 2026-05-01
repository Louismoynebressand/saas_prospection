-- 1. Correction du nom des colonnes (body_html au lieu de message)
-- 2. Comparaison robuste des IDs (text vs bigint vs uuid)
-- 3. Gestion du statut du Job
-- 4. Ajout des statuts 'pending' et 'processing' à la contrainte

-- Mise à jour de la contrainte de statut
ALTER TABLE public.campaign_prospects DROP CONSTRAINT IF EXISTS campaign_prospects_email_status_check;
ALTER TABLE public.campaign_prospects ADD CONSTRAINT campaign_prospects_email_status_check 
    CHECK (email_status IN ('not_generated', 'pending', 'processing', 'generated', 'sent', 'bounced', 'replied'));

CREATE OR REPLACE FUNCTION public.sync_cold_email_to_campaign_link()
RETURNS TRIGGER AS $$
DECLARE
    total_prospects INTEGER;
    generated_count INTEGER;
BEGIN
    -- 1. Mettre à jour le lien prospect-campagne avec le contenu généré
    -- On utilise COALESCE pour prendre body_html ou body_text
    -- On compare les IDs en les castant en TEXT pour éviter les erreurs de type (UUID vs BigInt)
    UPDATE public.campaign_prospects
    SET 
        email_status = 'generated',
        generated_email_subject = NEW.subject,
        generated_email_content = COALESCE(NEW.body_html, NEW.body_text),
        email_generated_at = NOW(),
        updated_at = NOW()
    WHERE campaign_id = NEW.campaign_id 
      AND prospect_id::text = NEW.prospect_id::text;

    -- 2. Vérifier si tous les prospects du Job ont été générés pour passer le Job en 'completed'
    -- On récupère le nombre total attendu dans le Job
    SELECT jsonb_array_length(prospect_ids) INTO total_prospects
    FROM public.cold_email_jobs 
    WHERE id = NEW.job_id;

    -- On compte combien ont été générés pour ce Job
    SELECT count(*) INTO generated_count
    FROM public.cold_email_generations 
    WHERE job_id = NEW.job_id;

    -- Si on a tout, on ferme le Job
    IF generated_count >= total_prospects THEN
        UPDATE public.cold_email_jobs
        SET 
            status = 'completed',
            completed_at = NOW()
        WHERE id = NEW.job_id;
    ELSE
        -- Sinon on s'assure qu'il est en 'running'
        UPDATE public.cold_email_jobs
        SET status = 'running'
        WHERE id = NEW.job_id AND status = 'pending';
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- On log l'erreur mais on ne bloque pas l'insertion principale
    RAISE WARNING 'Erreur dans sync_cold_email_to_campaign_link: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-création du trigger
DROP TRIGGER IF EXISTS on_cold_email_generated ON public.cold_email_generations;

CREATE TRIGGER on_cold_email_generated
AFTER INSERT ON public.cold_email_generations
FOR EACH ROW
EXECUTE FUNCTION public.sync_cold_email_to_campaign_link();
