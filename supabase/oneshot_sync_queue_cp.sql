-- =================================================================
-- ONE-SHOT SYNC : Réconciliation des données existantes
-- campaign_prospects = source de vérité → on met email_queue à jour
-- =================================================================

-- ── ÉTAPE 1 : Voir les désynchronisations actuelles ────────────────
SELECT
    eq.prospect_id,
    eq.campaign_id,
    eq.status           AS queue_status,
    cp.email_status     AS cp_status,
    CASE
        WHEN eq.status = 'sent'       AND cp.email_status IN ('opened','delivered','clicked','replied') THEN '⚠️ email_queue en retard'
        WHEN eq.status = 'pending'    AND cp.email_status = 'sent'    THEN '⚠️ email_queue en retard'
        WHEN eq.status = 'sent'       AND cp.email_status = 'generated' THEN '⚠️ campaign_prospects en retard'
        WHEN eq.status = cp.email_status THEN '✅ sync'
        ELSE '🔄 désync'
    END AS sync_state
FROM email_queue eq
JOIN campaign_prospects cp
  ON cp.campaign_id = eq.campaign_id
 AND cp.prospect_id = eq.prospect_id
WHERE eq.status IS DISTINCT FROM CASE cp.email_status
    WHEN 'generated' THEN 'pending'
    WHEN 'sending'   THEN 'processing'
    WHEN 'sent'      THEN 'sent'
    WHEN 'bounced'   THEN 'failed'
    ELSE eq.status
END
ORDER BY eq.prospect_id
LIMIT 50;


-- ── ÉTAPE 2 : Sync one-shot email_queue ← campaign_prospects ───────
-- campaign_prospects est la source de vérité (statuts plus précis)
-- On map les statuts cp vers les statuts équivalents de email_queue

UPDATE email_queue eq
SET
    status = CASE cp.email_status
        WHEN 'generated'  THEN 'pending'
        WHEN 'sending'    THEN 'processing'
        WHEN 'sent'       THEN 'sent'
        WHEN 'delivered'  THEN 'sent'      -- email_queue n'a pas 'delivered'
        WHEN 'opened'     THEN 'sent'      -- email_queue n'a pas 'opened'
        WHEN 'clicked'    THEN 'sent'      -- email_queue n'a pas 'clicked'
        WHEN 'replied'    THEN 'sent'      -- email_queue n'a pas 'replied'
        WHEN 'bounced'    THEN 'failed'
        ELSE eq.status                     -- not_generated → ne pas toucher
    END,
    sent_at = CASE
        WHEN cp.email_status IN ('sent','delivered','opened','clicked','replied')
             AND eq.sent_at IS NULL
        THEN COALESCE(cp.email_sent_at, NOW())
        ELSE eq.sent_at
    END,
    updated_at = NOW()
FROM campaign_prospects cp
WHERE cp.campaign_id = eq.campaign_id
  AND cp.prospect_id = eq.prospect_id
  -- Seulement si cp a un statut plus avancé que email_queue
  AND cp.email_status NOT IN ('not_generated')
  -- Seulement si ça change quelque chose (anti-boucle)
  AND CASE cp.email_status
        WHEN 'generated'  THEN 'pending'
        WHEN 'sending'    THEN 'processing'
        WHEN 'sent'       THEN 'sent'
        WHEN 'delivered'  THEN 'sent'
        WHEN 'opened'     THEN 'sent'
        WHEN 'clicked'    THEN 'sent'
        WHEN 'replied'    THEN 'sent'
        WHEN 'bounced'    THEN 'failed'
        ELSE eq.status
      END IS DISTINCT FROM eq.status;


-- ── ÉTAPE 3 : Vérification après sync ──────────────────────────────
SELECT
    COUNT(*) FILTER (WHERE eq.status = 'sent'      AND cp.email_status IN ('sent','delivered','opened','clicked','replied')) AS "queue:sent ↔ cp:avancé ✅",
    COUNT(*) FILTER (WHERE eq.status = 'pending'   AND cp.email_status = 'generated')  AS "queue:pending ↔ cp:generated ✅",
    COUNT(*) FILTER (WHERE eq.status = 'failed'    AND cp.email_status = 'bounced')    AS "queue:failed ↔ cp:bounced ✅",
    COUNT(*) FILTER (WHERE eq.status != CASE cp.email_status
        WHEN 'generated' THEN 'pending'
        WHEN 'sending'   THEN 'processing'
        WHEN 'sent'      THEN 'sent'
        WHEN 'delivered' THEN 'sent'
        WHEN 'opened'    THEN 'sent'
        WHEN 'clicked'   THEN 'sent'
        WHEN 'replied'   THEN 'sent'
        WHEN 'bounced'   THEN 'failed'
        ELSE eq.status END
    ) AS "encore désync ⚠️"
FROM email_queue eq
JOIN campaign_prospects cp
  ON cp.campaign_id = eq.campaign_id
 AND cp.prospect_id = eq.prospect_id;
