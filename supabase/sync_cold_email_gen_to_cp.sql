-- =================================================================
-- SYNC : cold_email_generations → campaign_prospects
-- 1. One-shot pour les données existantes (ex: prospect 132)
-- 2. Trigger pour les futures générations
-- =================================================================

-- -----------------------------------------------------------------
-- ÉTAPE 1 : One-shot — rattrapage des données existantes
-- Prend le mail le plus récent de cold_email_generations
-- et met à jour campaign_prospects si subject/content manquants
-- ou si statut encore 'not_generated' / 'pending'
-- -----------------------------------------------------------------
UPDATE campaign_prospects cp
SET
    generated_email_subject = latest.subject,
    generated_email_content = latest.message,
    email_status = CASE
        WHEN cp.email_status IN ('not_generated', 'pending') THEN 'generated'
        ELSE cp.email_status   -- ne pas rétrograder sent/opened/etc.
    END,
    email_generated_at = COALESCE(cp.email_generated_at, latest.created_at, NOW()),
    updated_at = NOW()
FROM (
    -- Prendre uniquement le dernier email généré par (campaign, prospect)
    SELECT DISTINCT ON (campaign_id, prospect_id::bigint)
        campaign_id,
        prospect_id::bigint AS prospect_id_bigint,
        subject,
        message,
        created_at
    FROM cold_email_generations
    WHERE subject IS NOT NULL
       OR message IS NOT NULL
    ORDER BY campaign_id, prospect_id::bigint, created_at DESC
) latest
WHERE cp.campaign_id = latest.campaign_id
  AND cp.prospect_id = latest.prospect_id_bigint
  AND (
      cp.generated_email_subject IS NULL
   OR cp.generated_email_content IS NULL
   OR cp.email_status IN ('not_generated', 'pending')
  );

-- Résultat du rattrapage
SELECT
    COUNT(*) FILTER (WHERE email_status = 'generated')     AS "passés à generated",
    COUNT(*) FILTER (WHERE generated_email_subject IS NOT NULL) AS "avec sujet rempli",
    COUNT(*) FILTER (WHERE generated_email_content IS NOT NULL) AS "avec contenu rempli",
    COUNT(*) FILTER (WHERE email_status = 'not_generated') AS "encore not_generated (sans génération disponible)"
FROM campaign_prospects;


-- -----------------------------------------------------------------
-- ÉTAPE 2 : Trigger — toute future insertion dans cold_email_generations
-- met automatiquement à jour campaign_prospects
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cold_email_gen_to_cp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE campaign_prospects
    SET
        generated_email_subject = NEW.subject,
        generated_email_content = NEW.message,
        -- Ne pas rétrograder un statut déjà avancé (sent, opened, etc.)
        email_status = CASE
            WHEN email_status IN ('not_generated', 'pending') THEN 'generated'
            ELSE email_status
        END,
        email_generated_at = COALESCE(email_generated_at, NEW.created_at, NOW()),
        updated_at = NOW()
    WHERE campaign_id = NEW.campaign_id
      AND prospect_id = NEW.prospect_id::bigint;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[fn_cold_email_gen_to_cp] ERREUR prospect=% campaign=% : %',
        NEW.prospect_id, NEW.campaign_id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_cold_email_gen_to_cp ON cold_email_generations;
CREATE TRIGGER tg_cold_email_gen_to_cp
    AFTER INSERT OR UPDATE OF subject, message ON cold_email_generations
    FOR EACH ROW
    EXECUTE FUNCTION fn_cold_email_gen_to_cp();

-- -----------------------------------------------------------------
-- VÉRIFICATION : triggers actifs sur cold_email_generations
-- -----------------------------------------------------------------
SELECT
    trigger_name,
    event_manipulation AS "event",
    event_object_table AS "table",
    action_timing      AS "timing"
FROM information_schema.triggers
WHERE event_object_table IN ('cold_email_generations', 'campaign_prospects')
ORDER BY event_object_table, trigger_name;
