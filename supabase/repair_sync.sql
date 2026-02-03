-- SCRIPT DE RÉPARATION CORRIGÉ (Text -> BigInt)
-- À exécuter pour corriger le passé

DO $$
DECLARE
    gen RECORD;
BEGIN
    RAISE NOTICE 'Début de la synchronisation (CORRIGÉE)...';

    FOR gen IN SELECT * FROM public.cold_email_generations LOOP
        BEGIN
            -- 1. Sync dans campaign_prospects avec CAST
            UPDATE public.campaign_prospects
            SET 
                email_status = 'generated',
                generated_email_subject = gen.subject,
                generated_email_content = gen.message,
                email_generated_at = gen.created_at,
                updated_at = NOW()
            WHERE campaign_id = gen.campaign_id 
              AND prospect_id = (gen.prospect_id)::bigint; -- CAST IMPORTANT
            
            -- RAISE NOTICE 'Email sync OK pour prospect %', gen.prospect_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Impossible de sync prospect % : erreur conversion ou lien manquant', gen.prospect_id;
        END;
    END LOOP;

    -- 2. Mettre à jour les status des Jobs
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
