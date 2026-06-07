-- Add step column to cold_email_generations for follow-ups tracking
ALTER TABLE public.cold_email_generations 
ADD COLUMN IF NOT EXISTS step INTEGER DEFAULT 1;

-- Add comment
COMMENT ON COLUMN public.cold_email_generations.step IS 'Indicates which follow-up step this email corresponds to (1 = initial cold email, 2+ = follow-ups)';
