-- =================================================================
-- Ajouter is_default dans smtp_configurations
-- Permet de définir un compte d'envoi par défaut par utilisateur
-- =================================================================

ALTER TABLE smtp_configurations
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Index partiel pour accélérer la recherche du compte par défaut
CREATE INDEX IF NOT EXISTS idx_smtp_configurations_default 
  ON smtp_configurations(user_id, is_default) 
  WHERE is_default = true;
