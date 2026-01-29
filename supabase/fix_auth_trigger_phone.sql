-- 1. Add phone column to profiles table if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone text;

-- 2. Update the handle_new_user function to include phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, company_name, phone, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'company_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''), -- Map 'phone' from metadata to 'phone' column
    new.email
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$;

-- 3. Update existing profiles with phone from auth.users metadata (Backfill)
UPDATE public.profiles p
SET phone = u.raw_user_meta_data->>'phone'
FROM auth.users u
WHERE p.id = u.id
AND p.phone IS NULL
AND u.raw_user_meta_data->>'phone' IS NOT NULL;
