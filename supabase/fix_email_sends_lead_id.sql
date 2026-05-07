-- =================================================================
-- FIX : Modifier le type de lead_id dans email_sends
-- =================================================================

-- Le champ lead_id a été créé en tant que UUID, mais les ID de prospects
-- provenant de scrape_prospects (et campaign_prospects) sont des BIGINT.
-- Cela empêche l'insertion dans email_sends.

ALTER TABLE public.email_sends
  ALTER COLUMN lead_id TYPE TEXT USING lead_id::text;
