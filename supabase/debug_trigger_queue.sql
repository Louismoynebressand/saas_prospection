-- =================================================================
-- DIAGNOSTIC : Pourquoi le trigger ne crée rien dans email_sends ?
-- Exécuter chaque bloc séparément dans Supabase SQL Editor
-- =================================================================

-- BLOC 1 : Vérifier les colonnes de campaign_prospects
-- (le trigger essaie generated_email_subject/html/text — existent-elles ?)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'campaign_prospects'
ORDER BY ordinal_position;

-- BLOC 2 : Vérifier les colonnes de cold_email_generations
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cold_email_generations'
ORDER BY ordinal_position;

-- BLOC 3 : Vérifier les colonnes de scrape_prospect (email_adresse_verified)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scrape_prospect'
  AND column_name ILIKE '%email%';

-- BLOC 4 : Regarder une vraie ligne de email_queue en statut sent
SELECT *
FROM email_queue
WHERE status = 'sent'
LIMIT 3;

-- BLOC 5 : Test manuel de la logique de récupération d'email
-- (remplacer les IDs par ceux d'une vraie ligne sent de email_queue)
-- SELECT
--     CASE
--         WHEN sp.email_adresse_verified LIKE '[%'
--         THEN (sp.email_adresse_verified::jsonb ->> 0)
--         ELSE sp.email_adresse_verified
--     END AS email_to
-- FROM scrape_prospect sp
-- WHERE sp.id_prospect = VOTRE_PROSPECT_ID_ICI;
