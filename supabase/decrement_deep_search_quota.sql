-- Fonction pour décrémenter le quota de Deep Search
-- Sécurisée avec vérification que l'utilisateur a assez de crédits

CREATE OR REPLACE FUNCTION decrement_deep_search_quota(
    p_user_id uuid,
    p_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mise à jour atomique avec vérification
    UPDATE user_quotas
    SET 
        deep_search_remaining = deep_search_remaining - p_amount,
        deep_search_used = deep_search_used + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND deep_search_remaining >= p_amount;
    
    -- Si aucune ligne n'a été mise à jour, c'est qu'il n'y a pas assez de crédits
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crédits Deep Search insuffisants pour l''utilisateur %', p_user_id;
    END IF;
END;
$$;

-- Commentaire
COMMENT ON FUNCTION decrement_deep_search_quota(uuid, integer) IS 'Décrémente le quota Deep Search de manière atomique avec vérification des crédits disponibles';
