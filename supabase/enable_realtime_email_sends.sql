-- =================================================================
-- Activer Supabase Realtime sur email_sends
-- À exécuter dans Supabase SQL Editor après mailgun_integration.sql
-- =================================================================

-- Active la réplication Realtime sur email_sends
-- Permet au frontend de s'abonner aux changements en temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_sends;

-- Optionnel : activer aussi email_events si vous voulez les observer
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.email_events;
