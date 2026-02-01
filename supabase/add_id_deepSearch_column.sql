-- Ajouter colonne id_deepSearch à scrape_prospect
-- Cette colonne référence le job deep_search_jobs seulement si deep search lancé APRÈS le scrape initial
-- Si deep search fait pendant le scrape initial, cette colonne reste NULL

ALTER TABLE scrape_prospect
ADD COLUMN IF NOT EXISTS id_deepSearch uuid REFERENCES deep_search_jobs(id) ON DELETE SET NULL;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_scrape_prospect_id_deepSearch ON scrape_prospect(id_deepSearch);

-- Commentaire
COMMENT ON COLUMN scrape_prospect.id_deepSearch IS 'Référence au job deep_search_jobs si deep search lancé après coup. NULL si deep search fait pendant scrape initial.';
