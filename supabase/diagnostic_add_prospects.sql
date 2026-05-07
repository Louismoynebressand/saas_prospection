-- ================================================================
-- DIAGNOSTIC : Pourquoi l'ajout de prospects à la campagne échoue
-- Exécuter dans Supabase SQL Editor pour identifier le problème
-- ================================================================

-- 1. Voir les contraintes FOREIGN KEY sur campaign_prospects
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'campaign_prospects'
  AND tc.constraint_type = 'FOREIGN KEY';

-- ================================================================

-- 2. Voir les contraintes FOREIGN KEY sur email_queue
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'email_queue'
  AND tc.constraint_type = 'FOREIGN KEY';

-- ================================================================

-- 3. Voir les triggers sur campaign_prospects
SELECT
    trigger_name,
    event_manipulation AS event,
    action_timing AS timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'campaign_prospects'
ORDER BY action_timing, event_manipulation;

-- ================================================================

-- 4. Vérifier s'il y a des lignes orphelines dans email_queue ou cold_email_generations
-- qui pointent vers une campagne supprimée (campaign_id qui n'existe plus)
SELECT 'email_queue orphelines' AS source, COUNT(*) AS nb
FROM email_queue eq
WHERE NOT EXISTS (
    SELECT 1 FROM cold_email_campaigns c WHERE c.id = eq.campaign_id
)

UNION ALL

SELECT 'cold_email_generations orphelines' AS source, COUNT(*) AS nb
FROM cold_email_generations ceg
WHERE NOT EXISTS (
    SELECT 1 FROM cold_email_campaigns c WHERE c.id = ceg.campaign_id
)

UNION ALL

SELECT 'campaign_prospects orphelines' AS source, COUNT(*) AS nb
FROM campaign_prospects cp
WHERE NOT EXISTS (
    SELECT 1 FROM cold_email_campaigns c WHERE c.id = cp.campaign_id
);
