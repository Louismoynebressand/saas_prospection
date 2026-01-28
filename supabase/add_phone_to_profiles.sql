-- Add phone field to profiles table
-- Run this migration in Supabase SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.profiles.phone IS 'User phone number for contact and signature purposes';
