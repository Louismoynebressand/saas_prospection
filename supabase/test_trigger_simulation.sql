-- =================================================================
-- DIAGNOSTIC VISIBLE — retourne des vraies lignes de résultats
-- Exécuter chaque bloc séparément dans Supabase SQL Editor
-- =================================================================

-- ── BLOC 1 : Y a-t-il des lignes 'sent' dans email_queue ? ────────
SELECT
    'email_queue'           AS table_name,
    id,
    campaign_id,
    prospect_id,
    schedule_id,
    status,
    sent_at,
    smtp_configuration_id
FROM email_queue
WHERE status = 'sent'
ORDER BY updated_at DESC
LIMIT 5;

-- ── BLOC 2 : La campagne liée existe-t-elle ? ──────────────────────
-- (Remplace campaign_id par celui trouvé au BLOC 1)
SELECT
    eq.id              AS queue_id,
    eq.campaign_id,
    eq.prospect_id,
    c.user_id,
    c.campaign_name
FROM email_queue eq
JOIN cold_email_campaigns c ON c.id = eq.campaign_id
WHERE eq.status = 'sent'
ORDER BY eq.updated_at DESC
LIMIT 3;

-- ── BLOC 3 : Y a-t-il un SMTP lié via campaign_schedules ? ─────────
SELECT
    eq.id              AS queue_id,
    eq.schedule_id,
    cs.smtp_configuration_id,
    sc.from_email,
    sc.provider,
    sc.is_active
FROM email_queue eq
LEFT JOIN campaign_schedules cs ON cs.id = eq.schedule_id
LEFT JOIN smtp_configurations sc ON sc.id = cs.smtp_configuration_id
WHERE eq.status = 'sent'
ORDER BY eq.updated_at DESC
LIMIT 3;

-- ── BLOC 4 : L'email du prospect est-il dispo ? ────────────────────
SELECT
    eq.id              AS queue_id,
    eq.prospect_id,
    sp.email_adresse_verified
FROM email_queue eq
JOIN scrape_prospect sp ON sp.id_prospect = eq.prospect_id
WHERE eq.status = 'sent'
ORDER BY eq.updated_at DESC
LIMIT 3;

-- ── BLOC 5 : Y a-t-il du contenu dans cold_email_generations ? ─────
SELECT
    eq.id              AS queue_id,
    eq.campaign_id,
    ceg.id             AS generation_id,
    ceg.prospect_id    AS gen_prospect_id,
    ceg.subject,
    LEFT(ceg.body_html, 50) AS body_preview
FROM email_queue eq
LEFT JOIN cold_email_generations ceg ON ceg.campaign_id = eq.campaign_id
WHERE eq.status = 'sent'
ORDER BY eq.updated_at DESC, ceg.created_at DESC
LIMIT 5;

-- ── BLOC 6 : Colonnes exactes de cold_email_generations ────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cold_email_generations'
ORDER BY ordinal_position;
