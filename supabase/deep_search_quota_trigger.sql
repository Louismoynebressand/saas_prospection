-- =================================================================
-- DEEP SEARCH QUOTA MANAGMENT
-- =================================================================

-- 1. Add column to track if deep search has been charged (Idempotency)
-- Using DO block to avoid error if column already exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scrape_prospect' AND column_name = 'deep_search_charged') THEN
        ALTER TABLE public.scrape_prospect ADD COLUMN deep_search_charged BOOLEAN DEFAULT FALSE;
    END IF;
END $$;


-- 2. Create the Trigger Function
CREATE OR REPLACE FUNCTION public.handle_deep_search_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Conditions to deduct quota:
    -- 1. New deep_search is NOT NULL and NOT empty json/string
    -- 2. Old deep_search WAS NULL or empty
    -- 3. deep_search_charged is FALSE (idempotency check)
    
    IF (NEW.deep_search IS NOT NULL AND NEW.deep_search::text NOT IN ('', '{}', '[]', 'null'))
       AND (OLD.deep_search IS NULL OR OLD.deep_search::text IN ('', '{}', '[]', 'null'))
       AND (NEW.deep_search_charged IS FALSE) THEN

        -- Deduct 1 credit from quota
        -- Casting NEW.id_user to uuid is required based on schema analysis
        UPDATE public.quotas
        SET deep_search_used = deep_search_used + 1,
            updated_at = now()
        WHERE user_id = NEW.id_user::uuid;

        -- Mark as charged so it never happens again for this prospect
        NEW.deep_search_charged := TRUE;
        
    END IF;

    RETURN NEW;
END;
$$;


-- 3. Create the Trigger (BEFORE UPDATE to update the boolean flag on the fly)
DROP TRIGGER IF EXISTS on_prospect_deep_search_update ON public.scrape_prospect;

CREATE TRIGGER on_prospect_deep_search_update
BEFORE UPDATE ON public.scrape_prospect
FOR EACH ROW
EXECUTE FUNCTION public.handle_deep_search_quota();

COMMENT ON FUNCTION public.handle_deep_search_quota IS 'Deducts deep search quota only once when deep_search data is first populated.';
