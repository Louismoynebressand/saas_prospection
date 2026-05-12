-- Fonction RPC pour incrémenter links_click_count sur campaign_prospects
-- Utilisée par le endpoint /api/track/[code] (service_role)

CREATE OR REPLACE FUNCTION public.increment_links_click_count(
    p_campaign_id UUID,
    p_prospect_id BIGINT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.campaign_prospects
    SET links_click_count = COALESCE(links_click_count, 0) + 1
    WHERE campaign_id = p_campaign_id
      AND prospect_id = p_prospect_id;
END;
$$;

-- Grant execute to service_role and authenticated
GRANT EXECUTE ON FUNCTION public.increment_links_click_count(UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_links_click_count(UUID, BIGINT) TO authenticated;
