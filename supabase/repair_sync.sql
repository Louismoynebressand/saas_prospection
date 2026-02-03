-- SCRIPT DE RÉPARATION / BACKFILL
-- À exécuter UNE SEULE FOIS pour corriger les emails déjà générés
-- qui n'apparaissent pas encore dans l'interface.

DO $$
DECLARE
    gen RECORD;
BEGIN
    RAISE NOTICE 'Début de la synchronisation des emails existants...';

    FOR gen IN SELECT * FROM public.cold_email_generations LOOP
        -- 1. Sync dans campaign_prospects
        UPDATE public.campaign_prospects
        SET 
            email_status = 'generated',
            generated_email_subject = gen.subject,
            generated_email_content = gen.message,
            email_generated_at = gen.created_at,
            updated_at = NOW()
        WHERE campaign_id = gen.campaign_id 
          AND prospect_id = gen.prospect_id; -- Attention: prospect_id doit être du même type (text vs uuid cast si besoin)
        
        RAISE NOTICE 'Email sync pour prospect % (Job %)', gen.prospect_id, gen.job_id;
    END LOOP;

    -- 2. Mettre à jour les status des Jobs (fix complet)
    UPDATE public.cold_email_jobs j
    SET 
        status = 'completed',
        completed_at = NOW()
    WHERE status != 'completed'
      AND (
          SELECT count(*) 
          FROM public.cold_email_generations g
          WHERE g.job_id = j.id
      ) >= (
          SELECT jsonb_array_length(prospect_ids) 
          FROM public.cold_email_jobs 
          WHERE id = j.id
      );

    RAISE NOTICE 'Terminé.';
END $$;
