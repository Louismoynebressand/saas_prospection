SELECT 
    id, 
    email, 
    phone, 
    first_name, 
    last_name,
    created_at
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 5;
