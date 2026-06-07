ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view steps of their campaigns" ON public.campaign_steps;
CREATE POLICY "Users can view steps of their campaigns"
ON public.campaign_steps FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.cold_email_campaigns c
        WHERE c.id = campaign_steps.campaign_id AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert steps to their campaigns" ON public.campaign_steps;
CREATE POLICY "Users can insert steps to their campaigns"
ON public.campaign_steps FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.cold_email_campaigns c
        WHERE c.id = campaign_steps.campaign_id AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can update steps of their campaigns" ON public.campaign_steps;
CREATE POLICY "Users can update steps of their campaigns"
ON public.campaign_steps FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.cold_email_campaigns c
        WHERE c.id = campaign_steps.campaign_id AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete steps of their campaigns" ON public.campaign_steps;
CREATE POLICY "Users can delete steps of their campaigns"
ON public.campaign_steps FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.cold_email_campaigns c
        WHERE c.id = campaign_steps.campaign_id AND c.user_id = auth.uid()
    )
);
