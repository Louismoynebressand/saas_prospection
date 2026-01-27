-- =================================================================
-- FIX TRIGGER: Correction du nom de colonne dans handle_new_prospect_quota
-- =================================================================
-- Diagnostique : La fonction tentait d'incrémenter "prospects_scraped" qui n'existe pas.
-- Correction : On incrémente "scraps_used" qui est la colonne officielle (vue dans quota_functions.sql).

CREATE OR REPLACE FUNCTION public.handle_new_prospect_quota()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Incrémenter le compteur 'scraps_used' (et non prospects_scraped)
  UPDATE public.quotas
  SET scraps_used = scraps_used + 1,
      updated_at = now()
  WHERE user_id = NEW.id_user::uuid;

  RETURN NEW;
END;
$$;

-- Note: Pas besoin de recréer le trigger, il pointe déjà sur cette fonction.
-- La mise à jour du code de la fonction s'applique immédiatement.

-- Validation : On vérifie que la colonne existe bien pour être sûr
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotas' AND column_name = 'scraps_used') THEN
    RAISE EXCEPTION 'La colonne scraps_used n''existe pas dans la table quotas !';
  END IF;
END $$;
