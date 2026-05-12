-- ============================================================
-- Système de tracking de liens pour les signatures d'email
-- ============================================================

-- 1. Table principale des liens traqués (1 par lien par prospect/campagne)
CREATE TABLE IF NOT EXISTS public.email_tracked_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES cold_email_campaigns(id) ON DELETE CASCADE,
    prospect_id BIGINT NOT NULL,
    link_type TEXT NOT NULL CHECK (link_type IN ('phone', 'email', 'website', 'custom')),
    link_label TEXT,                         -- ex: "Visitez notre site", "Appeler", etc.
    original_url TEXT NOT NULL,              -- URL de destination réelle
    short_code TEXT NOT NULL UNIQUE,         -- code 8 chars alphanumérique unique
    click_count INT NOT NULL DEFAULT 0,
    first_clicked_at TIMESTAMPTZ,
    last_clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tracked_links_short_code ON email_tracked_links(short_code);
CREATE INDEX IF NOT EXISTS idx_email_tracked_links_campaign_prospect ON email_tracked_links(campaign_id, prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_tracked_links_prospect ON email_tracked_links(prospect_id);

-- 2. Table des événements de clic individuels
CREATE TABLE IF NOT EXISTS public.email_link_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracked_link_id UUID NOT NULL REFERENCES email_tracked_links(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_link_clicks_tracked_link ON email_link_clicks(tracked_link_id);
CREATE INDEX IF NOT EXISTS idx_email_link_clicks_clicked_at ON email_link_clicks(clicked_at);

-- 3. Nouvelles colonnes sur campaign_prospects
ALTER TABLE public.campaign_prospects
    ADD COLUMN IF NOT EXISTS signature_tracked_html TEXT,
    ADD COLUMN IF NOT EXISTS links_click_count INT NOT NULL DEFAULT 0;

-- 4. RLS sur email_tracked_links
ALTER TABLE public.email_tracked_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own tracked links" ON email_tracked_links;
CREATE POLICY "Users see own tracked links" ON email_tracked_links
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM cold_email_campaigns WHERE user_id = auth.uid()
        )
    );

-- 5. RLS sur email_link_clicks
-- Les clics sont insérés via service_role (endpoint /api/track sans user auth)
-- La lecture est autorisée pour les propriétaires de campagne
ALTER TABLE public.email_link_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own link clicks" ON email_link_clicks;
CREATE POLICY "Users see own link clicks" ON email_link_clicks
    FOR SELECT USING (
        tracked_link_id IN (
            SELECT etl.id FROM email_tracked_links etl
            JOIN cold_email_campaigns c ON etl.campaign_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- Service role peut tout faire (pour /api/track)
DROP POLICY IF EXISTS "Service role full access tracked links" ON email_tracked_links;
CREATE POLICY "Service role full access tracked links" ON email_tracked_links
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access clicks" ON email_link_clicks;
CREATE POLICY "Service role full access clicks" ON email_link_clicks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Vue agrégée pour le dashboard
CREATE OR REPLACE VIEW public.email_link_stats_by_campaign AS
SELECT
    etl.campaign_id,
    c.user_id,
    COUNT(etl.id) AS total_links_created,
    SUM(etl.click_count) AS total_clicks,
    SUM(CASE WHEN etl.link_type = 'phone' THEN etl.click_count ELSE 0 END) AS phone_clicks,
    SUM(CASE WHEN etl.link_type = 'email' THEN etl.click_count ELSE 0 END) AS email_clicks,
    SUM(CASE WHEN etl.link_type = 'website' THEN etl.click_count ELSE 0 END) AS website_clicks,
    SUM(CASE WHEN etl.link_type = 'custom' THEN etl.click_count ELSE 0 END) AS custom_clicks,
    COUNT(CASE WHEN etl.click_count > 0 THEN 1 END) AS links_with_clicks,
    MAX(etl.last_clicked_at) AS last_click_at
FROM email_tracked_links etl
JOIN cold_email_campaigns c ON etl.campaign_id = c.id
GROUP BY etl.campaign_id, c.user_id;

-- Vue par prospect (pour fiche prospect)
CREATE OR REPLACE VIEW public.email_link_stats_by_prospect AS
SELECT
    etl.prospect_id,
    etl.campaign_id,
    c.name AS campaign_name,
    c.user_id,
    etl.link_type,
    etl.link_label,
    etl.original_url,
    etl.short_code,
    etl.click_count,
    etl.first_clicked_at,
    etl.last_clicked_at
FROM email_tracked_links etl
JOIN cold_email_campaigns c ON etl.campaign_id = c.id
WHERE etl.click_count > 0
ORDER BY etl.last_clicked_at DESC;
