-- ============================================================
-- MIGRATION COLD EMAIL CAMPAIGNS - PHASE 1: CLEANUP
-- Migrer données FR → EN et supprimer colonnes FR
-- ============================================================

BEGIN;

-- 1. Migrer les données des colonnes FR vers EN (si EN est NULL)
UPDATE cold_email_campaigns
SET 
    my_company_name = COALESCE(my_company_name, nom_entreprise_client),
    my_website = COALESCE(my_website, site_web_client),
    pitch = COALESCE(pitch, phrase_positionnement_client),
    main_offer = COALESCE(main_offer, offre_principale_client)
WHERE 
    my_company_name IS NULL OR 
    my_website IS NULL OR 
    pitch IS NULL OR 
    main_offer IS NULL;

-- 2. Vérifier qu'aucune donnée ne sera perdue
DO $$
DECLARE
    lost_company INTEGER;
    lost_website INTEGER;
    lost_pitch INTEGER;
    lost_offer INTEGER;
BEGIN
    SELECT COUNT(*) INTO lost_company FROM cold_email_campaigns WHERE nom_entreprise_client IS NOT NULL AND my_company_name IS NULL;
    SELECT COUNT(*) INTO lost_website FROM cold_email_campaigns WHERE site_web_client IS NOT NULL AND my_website IS NULL;
    SELECT COUNT(*) INTO lost_pitch FROM cold_email_campaigns WHERE phrase_positionnement_client IS NOT NULL AND pitch IS NULL;
    SELECT COUNT(*) INTO lost_offer FROM cold_email_campaigns WHERE offre_principale_client IS NOT NULL AND main_offer IS NULL;
    
    IF lost_company > 0 OR lost_website > 0 OR lost_pitch > 0 OR lost_offer > 0 THEN
        RAISE EXCEPTION 'Perte de données détectée: company=%, website=%, pitch=%, offer=%', lost_company, lost_website, lost_pitch, lost_offer;
    END IF;
    
    RAISE NOTICE 'Migration OK - Aucune perte de données';
END $$;

-- 3. Supprimer les colonnes FR devenues obsolètes
ALTER TABLE cold_email_campaigns
DROP COLUMN IF EXISTS nom_entreprise_client,
DROP COLUMN IF EXISTS site_web_client,
DROP COLUMN IF EXISTS phrase_positionnement_client,
DROP COLUMN IF EXISTS offre_principale_client;

-- 4. Renommer les colonnes restantes pour cohérence (optionnel)
-- Si on veut tout harmoniser en anglais
ALTER TABLE cold_email_campaigns
RENAME COLUMN nom_campagne TO campaign_name;

ALTER TABLE cold_email_campaigns
RENAME COLUMN promesse_principale TO main_promise;

ALTER TABLE cold_email_campaigns
RENAME COLUMN benefices_secondaires TO secondary_benefits;

ALTER TABLE cold_email_campaigns
RENAME COLUMN service_a_vendre TO service_to_sell;

ALTER TABLE cold_email_campaigns
RENAME COLUMN type_de_prospect_vise TO target_audience;

ALTER TABLE cold_email_campaigns
RENAME COLUMN ton_souhaite TO desired_tone;

ALTER TABLE cold_email_campaigns
RENAME COLUMN themes_de_douleurs_autorises TO allowed_pain_themes;

ALTER TABLE cold_email_campaigns
RENAME COLUMN mots_interdits TO forbidden_words;

ALTER TABLE cold_email_campaigns
RENAME COLUMN chiffres_autorises TO allowed_metrics;

ALTER TABLE cold_email_campaigns
RENAME COLUMN contraintes TO constraints;

ALTER TABLE cold_email_campaigns
RENAME COLUMN vouvoiement TO formal;

COMMIT;

-- Vérification finale
SELECT 
    COUNT(*) as total_campaigns,
    COUNT(campaign_name) as has_name,
    COUNT(my_company_name) as has_company,
    COUNT(my_website) as has_website,
    COUNT(pitch) as has_pitch
FROM cold_email_campaigns;
