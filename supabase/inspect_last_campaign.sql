-- 🕵️ REQUÊTE D'INSPECTION
-- Cette requête récupère la TOUTE DERNIÈRE campagne créée pour vérifier les données enregistrées.

SELECT * 
FROM cold_email_campaigns 
ORDER BY created_at DESC 
LIMIT 1;
