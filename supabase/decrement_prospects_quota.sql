-- Créer une fonction pour décrémenter les quotas basée sur le nombre de prospects
CREATE OR REPLACE FUNCTION public.decrement_prospects_quota(
    p_user_id uuid,
    p_count int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.quotas
    SET scraps_used = scraps_used + p_count,
        updated_at = now()
    WHERE user_id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.decrement_prospects_quota TO authenticated, service_role;

-- Commentaire
COMMENT ON FUNCTION public.decrement_prospects_quota IS 
'Décrémente le quota de prospects scrapés pour un utilisateur. 1 crédit = 1 prospect trouvé.';
