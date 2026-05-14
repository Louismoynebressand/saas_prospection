-- ============================================================
-- TRIGGER : Sync email_verification_results → scrape_prospect
-- Dès qu'un résultat de vérification email est inséré,
-- on met automatiquement à jour le statut dans scrape_prospect
-- ============================================================
-- ⚠️ Exécuter dans Supabase SQL Editor

-- FONCTION du trigger
CREATE OR REPLACE FUNCTION fn_sync_email_verif_to_prospect()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
    v_rows_updated INT;
BEGIN
    -- La colonne email dans email_verification_results s'appelle "email_checked"
    v_email := trim(NEW.email_checked);

    IF v_email IS NULL OR v_email = '' THEN
        RETURN NEW;
    END IF;

    -- Mettre à jour scrape_prospect où email_adresse_verified correspond
    -- email_adresse_verified peut être stocké comme :
    --   - texte brut  : contact@example.com
    --   - JSON string : "contact@example.com"
    --   - JSON array  : ["contact@example.com"]
    UPDATE public.scrape_prospect
    SET
        succed_validation_smtp_email = NEW.is_valid,
        check_email = TRUE
    WHERE
        email_adresse_verified = v_email
        OR email_adresse_verified = '"' || v_email || '"'
        OR email_adresse_verified = '["' || v_email || '"]'
        OR email_adresse_verified ILIKE v_email;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    RAISE LOG '[fn_sync_email_verif_to_prospect] Email: %, is_valid: %, rows updated: %',
              v_email, NEW.is_valid, v_rows_updated;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[fn_sync_email_verif_to_prospect] ERREUR sur email %: %', v_email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS tg_sync_email_verif_to_prospect ON public.email_verification_results;

-- Créer le trigger sur INSERT et UPDATE de is_valid
CREATE TRIGGER tg_sync_email_verif_to_prospect
    AFTER INSERT OR UPDATE OF is_valid ON public.email_verification_results
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_email_verif_to_prospect();

-- ============================================================
-- VÉRIFICATION
-- ============================================================
SELECT
    trigger_name,
    event_manipulation AS event,
    event_object_table AS "table",
    action_timing AS timing
FROM information_schema.triggers
WHERE trigger_name = 'tg_sync_email_verif_to_prospect';
