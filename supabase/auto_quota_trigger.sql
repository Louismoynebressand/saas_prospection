-- =================================================================
-- AUTOMATISATION DES QUOTAS VIA TRIGGER
-- =================================================================
-- Ce script crée un trigger qui s'exécute automatiquement à chaque fois
-- qu'un prospect est ajouté dans la table scrape_prospect.
-- Plus besoin d'appeler l'API depuis n8n !

-- 1. Créer la fonction du trigger
CREATE OR REPLACE FUNCTION public.handle_new_prospect_quota()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Incrémenter le compteur de prospects scrapés
  -- On caste NEW.id_user (text) vers uuid pour correspondre à la table quotas
  UPDATE public.quotas
  SET prospects_scraped = prospects_scraped + 1,
      updated_at = now()
  WHERE user_id = NEW.id_user::uuid;

  -- (Optionnel) Ici on pourrait aussi gérer le deep search si besoin
  -- IF NEW.deep_search IS NOT NULL AND NEW.deep_search::text != '{}' THEN ...

  RETURN NEW;
END;
$$;

-- 2. Créer le trigger (ou le remplacer s'il existe déjà)
DROP TRIGGER IF EXISTS on_prospect_created ON public.scrape_prospect;

CREATE TRIGGER on_prospect_created
AFTER INSERT ON public.scrape_prospect
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_prospect_quota();

-- 3. Commentaire
COMMENT ON FUNCTION public.handle_new_prospect_quota IS 
'Incrémente automatiquement les quotas quand un prospect est inséré.';
