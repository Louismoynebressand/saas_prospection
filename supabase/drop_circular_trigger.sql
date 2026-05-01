-- Suppression du trigger problématique sur campaign_prospects
-- Ce trigger faisait l'inverse : quand on met à jour campaign_prospects,
-- il essayait de ré-insérer dans cold_email_generations → doublon → erreur.
-- Le bon sens est : cold_email_generations (n8n) → campaign_prospects, PAS l'inverse.

-- 1. Supprimer le trigger
DROP TRIGGER IF EXISTS on_email_generated ON public.campaign_prospects;

-- 2. Supprimer la fonction associée (elle n'est plus nécessaire)
DROP FUNCTION IF EXISTS public.sync_cold_email_generation();

-- Vérification : lister les triggers restants sur campaign_prospects
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'campaign_prospects';
-- Résultat attendu : aucune ligne (pas de triggers sur campaign_prospects)
