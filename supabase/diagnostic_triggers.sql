-- DIAGNOSTIC : Lister tous les triggers actifs dans la base
-- Exécuter dans le SQL Editor Supabase pour identifier la source du problème

SELECT 
    t.trigger_name,
    t.event_object_table AS "table",
    t.event_manipulation AS "event",
    t.action_timing AS "timing",
    p.proname AS "function_name"
FROM information_schema.triggers t
JOIN pg_proc p ON p.proname = regexp_replace(t.action_statement, 'EXECUTE (FUNCTION|PROCEDURE) (.+)\(\)', '\2')
WHERE t.trigger_schema = 'public'
ORDER BY t.event_object_table, t.trigger_name;
