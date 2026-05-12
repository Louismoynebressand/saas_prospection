CREATE OR REPLACE FUNCTION process_tracked_link_click(
    p_short_code text,
    p_ip_address text,
    p_user_agent text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_link record;
    v_now timestamptz := now();
BEGIN
    -- 1. Find the link
    SELECT id, original_url, campaign_id, prospect_id, click_count, first_clicked_at
    INTO v_link
    FROM email_tracked_links
    WHERE short_code = p_short_code;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- 2. Update tracked link stats
    UPDATE email_tracked_links
    SET click_count = COALESCE(click_count, 0) + 1,
        last_clicked_at = v_now,
        first_clicked_at = COALESCE(first_clicked_at, v_now)
    WHERE id = v_link.id;

    -- 3. Insert click event
    INSERT INTO email_link_clicks (tracked_link_id, clicked_at, ip_address, user_agent)
    VALUES (v_link.id, v_now, p_ip_address, p_user_agent);

    -- 4. Increment campaign prospect stats
    UPDATE campaign_prospects
    SET links_click_count = COALESCE(links_click_count, 0) + 1
    WHERE campaign_id = v_link.campaign_id
      AND prospect_id = v_link.prospect_id;

    RETURN v_link.original_url;
END;
$$;
