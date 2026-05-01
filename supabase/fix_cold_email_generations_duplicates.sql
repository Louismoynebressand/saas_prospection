-- ==============================================================================
-- FIX COLD EMAIL GENERATIONS DUPLICATES
-- ==============================================================================
-- Problème : La table cold_email_generations subit des duplications massives
--            à cause de tentatives répétées (retries) depuis n8n sans
--            contrainte d'unicité pour les bloquer.
--
-- Solution : 
-- 1. Supprimer les doublons existants en ne gardant que la génération la 
--    plus récente pour chaque couple (campaign_id, prospect_id).
-- 2. Ajouter une contrainte UNIQUE (campaign_id, prospect_id) pour que la
--    base de données rejette automatiquement toute future tentative de duplication.
-- ==============================================================================

BEGIN;

-- 1. Nettoyage des doublons
-- On supprime toutes les lignes sauf la plus récente (created_at DESC)
-- pour chaque prospect dans une même campagne.
DELETE FROM public.cold_email_generations
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY campaign_id, prospect_id 
                ORDER BY created_at DESC, id DESC
            ) as row_num
        FROM public.cold_email_generations
    ) subquery
    WHERE row_num > 1
);

-- 2. Suppression de la contrainte si elle existait déjà (par précaution)
ALTER TABLE public.cold_email_generations
DROP CONSTRAINT IF EXISTS unique_campaign_prospect_generation;

-- 3. Ajout de la contrainte d'unicité forte
-- Cette contrainte empêchera n8n d'insérer 2 fois le même prospect pour la même campagne.
ALTER TABLE public.cold_email_generations
ADD CONSTRAINT unique_campaign_prospect_generation UNIQUE (campaign_id, prospect_id);

COMMIT;

-- Note : si n8n tente de réinsérer un email déjà généré, il recevra une erreur 
-- 409 Conflict ou 500 (Unique violation), ce qui est le comportement attendu
-- pour bloquer la duplication sans endommager la logique globale.
