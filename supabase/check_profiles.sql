-- Vérifier la structure de la table profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- Vérifier les données
SELECT id, first_name, last_name, company_name, created_at
FROM profiles
LIMIT 5;

-- Compter le nombre de profils
SELECT COUNT(*) as total_profiles FROM profiles;
